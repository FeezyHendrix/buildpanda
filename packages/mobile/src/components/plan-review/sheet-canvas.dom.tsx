"use dom";

import "./pdfjs-setup";
import { useEffect, useRef, useState } from "react";
import {
  beginPinch,
  clampTransform as clampToViewport,
  CLOUD_MIN_SIZE_PCT,
  FIT_TRANSFORM,
  GESTURE_MODE,
  IDLE_GESTURE,
  LOUPE_MODES,
  MEASURE_MIN_LEN_PCT,
  overlayStyle,
  PEN_MIN_STEP_PCT,
  pinchTransform,
  round2,
  TAP_SLOP_PX,
  type Gesture,
  type Transform,
} from "./canvas-support";
import { measureDistancePct, normalizedRect } from "./markup-shapes";
import { hitTestMarkup, MarkupLayer } from "./markup-svg";
import { SheetLoupe } from "./sheet-loupe";
import { useSheetPage } from "./use-sheet-page";
import { palette } from "@/constants/colors";
import { MARKUP_KIND, SHEET_TOOL } from "./markup-types";
import type { MarkupGeometry, MarkupPoint, MarkupRect, SheetMarkup, SheetRenderInfo, SheetTool } from "./markup-types";

export default function SheetCanvas({
  docKey,
  pdfBase64,
  imageDataUri,
  pageNo,
  markups,
  selectedId,
  tool,
  color,
  metresPerPct,
  fitNonce,
  draftPin,
  onCreate,
  onTapPoint,
  onSelect,
  onRendered,
  onZoom,
  dom: _dom,
}: {
  docKey: string;
  pdfBase64: string | null;
  imageDataUri: string | null;
  pageNo: number;
  markups: SheetMarkup[];
  selectedId: string | null;
  tool: SheetTool;
  /** The rail's markup colour: what a draft is drawn in before it is saved. */
  color: string;
  /** The sheet's calibrated scale, or null while a measure can only say "no scale set". */
  metresPerPct: number | null;
  /** Bump to fit the page to the viewport again (the rail's Fit button). */
  fitNonce: number;
  draftPin: MarkupPoint | null;
  onCreate: (geometry: MarkupGeometry) => Promise<void>;
  onTapPoint: (at: MarkupPoint) => Promise<void>;
  onSelect: (id: string | null) => Promise<void>;
  onRendered: (info: SheetRenderInfo) => Promise<void>;
  /** The zoom as a whole percentage, whenever it settles on a new value. */
  onZoom: (pct: number) => Promise<void>;
  dom?: import("expo/dom").DOMProps;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture>({ ...IDLE_GESTURE });
  // drafts are mirrored in refs so a pointer-up can read them without a setState updater side effect
  const penRef = useRef<MarkupPoint[] | null>(null);
  const rectRef = useRef<MarkupRect | null>(null);
  const measureStartRef = useRef<MarkupPoint | null>(null);
  const onZoomRef = useRef(onZoom);
  onZoomRef.current = onZoom;

  const [vpSize, setVpSize] = useState({ w: 0, h: 0 });
  const [transform, setTransform] = useState<Transform>(FIT_TRANSFORM);
  const [draftPen, setDraftPen] = useState<MarkupPoint[] | null>(null);
  const [draftRect, setDraftRect] = useState<MarkupRect | null>(null);
  const [draftMeasure, setDraftMeasure] = useState<{ a: MarkupPoint; b: MarkupPoint } | null>(null);
  const [measureStart, setMeasureStart] = useState<MarkupPoint | null>(null);
  // where the finger is while it places a point, so the loupe can show what it covers
  const [touch, setTouch] = useState<{ x: number; y: number } | null>(null);

  const { aspect, loading, error, imageLoaded } = useSheetPage({ docKey, pdfBase64, imageDataUri, pageNo, canvasRef, onRendered });
  const box = { w: vpSize.w, h: vpSize.w * aspect };

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setVpSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // A new page, and the Fit button, both start from the page fitted to the viewport.
  useEffect(() => {
    setTransform(FIT_TRANSFORM);
    clearDrafts();
  }, [docKey, pageNo, fitNonce]);

  // A measure's first point belongs to the tool that placed it.
  useEffect(() => {
    if (tool !== SHEET_TOOL.MEASURE) setMeasureStartBoth(null);
  }, [tool]);

  const zoomPct = Math.round(transform.s * 100);
  useEffect(() => {
    void onZoomRef.current(zoomPct);
  }, [zoomPct]);

  function setPenBoth(points: MarkupPoint[] | null) {
    penRef.current = points;
    setDraftPen(points);
  }
  function setRectBoth(rect: MarkupRect | null) {
    rectRef.current = rect;
    setDraftRect(rect);
  }
  function setMeasureStartBoth(at: MarkupPoint | null) {
    measureStartRef.current = at;
    setMeasureStart(at);
  }
  function clearDrafts() {
    setPenBoth(null);
    setRectBoth(null);
    setDraftMeasure(null);
    setMeasureStartBoth(null);
  }

  function pctFromClient(clientX: number, clientY: number): MarkupPoint | null {
    const el = contentRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return null;
    return { x: round2(x), y: round2(y) };
  }

  const clampTransform = (t: Transform): Transform => clampToViewport(t, box, vpSize);
  const viewportOrigin = () => {
    const vp = viewportRef.current?.getBoundingClientRect();
    return { left: vp?.left ?? 0, top: vp?.top ?? 0 };
  };

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;

    if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()];
      clearDrafts();
      setTouch(null);
      beginPinch(g, p1, p2, transform, viewportOrigin());
      return;
    }
    if (pointers.current.size !== 1) return;

    g.startX = g.lastX = e.clientX;
    g.startY = g.lastY = e.clientY;
    g.moved = false;
    g.startPct = pctFromClient(e.clientX, e.clientY);
    g.measureFrom = null;

    if (tool === SHEET_TOOL.PEN) {
      g.mode = GESTURE_MODE.PEN;
      setPenBoth(g.startPct ? [g.startPct] : []);
    } else if (tool === SHEET_TOOL.COMMENT) {
      g.mode = GESTURE_MODE.TAP;
    } else if (tool === SHEET_TOOL.CLOUD) {
      g.mode = GESTURE_MODE.CLOUD;
      setRectBoth(g.startPct ? { ...g.startPct, w: 0, h: 0 } : null);
    } else if (tool === SHEET_TOOL.MEASURE) {
      g.mode = GESTURE_MODE.MEASURE;
      // a second tap measures from the first; a fresh drag measures from where it began
      g.measureFrom = measureStartRef.current ?? g.startPct;
    } else {
      g.mode = GESTURE_MODE.PAN;
    }
    if (LOUPE_MODES.includes(g.mode)) setTouch({ x: e.clientX, y: e.clientY });
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;

    if (Math.abs(e.clientX - g.startX) + Math.abs(e.clientY - g.startY) > TAP_SLOP_PX) g.moved = true;

    // the loupe rides the finger while it draws, places a comment or measures
    if (LOUPE_MODES.includes(g.mode)) setTouch({ x: e.clientX, y: e.clientY });

    if (g.mode === GESTURE_MODE.PINCH && pointers.current.size >= 2) {
      const [p1, p2] = [...pointers.current.values()];
      const next = pinchTransform(g, p1, p2, viewportOrigin());
      if (next) setTransform(clampTransform(next));
      return;
    }

    if (g.mode === GESTURE_MODE.PAN) {
      const dx = e.clientX - g.lastX;
      const dy = e.clientY - g.lastY;
      g.lastX = e.clientX;
      g.lastY = e.clientY;
      setTransform((t) => clampTransform({ s: t.s, tx: t.tx + dx, ty: t.ty + dy }));
      return;
    }

    const pt = pctFromClient(e.clientX, e.clientY);
    if (!pt) return;

    if (g.mode === GESTURE_MODE.PEN) {
      const prev = penRef.current;
      if (!prev) return;
      const last = prev[prev.length - 1];
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < PEN_MIN_STEP_PCT) return;
      setPenBoth([...prev, pt]);
    } else if (g.mode === GESTURE_MODE.CLOUD && g.startPct) {
      setRectBoth(normalizedRect(g.startPct, pt));
    } else if (g.mode === GESTURE_MODE.MEASURE && g.measureFrom && g.moved) {
      setDraftMeasure({ a: g.measureFrom, b: pt });
    }
  }

  function finishMeasure(g: Gesture, e: React.PointerEvent<HTMLDivElement>) {
    const pt = pctFromClient(e.clientX, e.clientY);
    setDraftMeasure(null);
    if (!g.moved && !measureStartRef.current) {
      // first of two taps: hold the point and wait for the second
      setMeasureStartBoth(g.startPct);
      return;
    }
    const from = g.measureFrom;
    setMeasureStartBoth(null);
    if (!from || !pt) return;
    if (measureDistancePct(from, pt, aspect) < MEASURE_MIN_LEN_PCT) return;
    void onCreate({ kind: MARKUP_KIND.MEASURE, a: from, b: pt });
  }

  function finishSinglePointer(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    setTouch(null);

    if (g.mode === GESTURE_MODE.PEN) {
      const points = penRef.current;
      setPenBoth(null);
      if (points && points.length >= 2) void onCreate({ kind: MARKUP_KIND.PEN, points });
    } else if (g.mode === GESTURE_MODE.CLOUD) {
      const rect = rectRef.current;
      setRectBoth(null);
      if (rect && rect.w > CLOUD_MIN_SIZE_PCT && rect.h > CLOUD_MIN_SIZE_PCT) void onCreate({ kind: MARKUP_KIND.CLOUD, rect });
    } else if (g.mode === GESTURE_MODE.MEASURE) {
      finishMeasure(g, e);
    } else if (g.mode === GESTURE_MODE.TAP && !g.moved) {
      const pt = pctFromClient(e.clientX, e.clientY);
      if (pt) void onTapPoint(pt);
    } else if (g.mode === GESTURE_MODE.PAN && !g.moved) {
      const pt = pctFromClient(e.clientX, e.clientY);
      if (pt) {
        const hit = hitTestMarkup(markups, { x: (pt.x / 100) * box.w, y: (pt.y / 100) * box.h }, box.w, box.h, 24 / transform.s);
        void onSelect(hit);
      }
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;

    if (g.mode === GESTURE_MODE.PINCH) {
      if (pointers.current.size === 1) {
        const [rest] = [...pointers.current.values()];
        g.mode = GESTURE_MODE.PAN;
        g.lastX = rest.x;
        g.lastY = rest.y;
        g.moved = true;
      } else if (pointers.current.size === 0) {
        g.mode = GESTURE_MODE.IDLE;
      }
      return;
    }

    finishSinglePointer(e);
    if (pointers.current.size === 0) gesture.current = { ...IDLE_GESTURE };
  }

  return (
    <div
      ref={viewportRef}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        background: palette.grey50,
        touchAction: "none",
        userSelect: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        ref={contentRef}
        style={{
          width: box.w,
          height: box.h,
          position: "relative",
          transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.s})`,
          transformOrigin: "0 0",
          background: palette.surface,
        }}
      >
        {imageDataUri ? (
          <img
            ref={imgRef}
            src={imageDataUri}
            alt="Plan sheet"
            draggable={false}
            style={{ width: "100%", height: "100%", display: "block" }}
            onLoad={(e) => imageLoaded(e.currentTarget)}
          />
        ) : (
          <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
        )}
        <MarkupLayer
          markups={markups}
          draft={{ pen: draftPen, rect: draftRect, measure: draftMeasure, measureStart, pin: draftPin }}
          draftColor={color}
          width={box.w}
          height={box.h}
          selectedId={selectedId}
          aspect={aspect}
          metresPerPct={metresPerPct}
        />
      </div>

      <SheetLoupe
        source={{ el: imageDataUri ? imgRef.current : canvasRef.current, boxW: box.w, boxH: box.h }}
        at={touch}
        transform={transform}
        viewportW={viewportRef.current?.clientWidth ?? 0}
        color={color}
      />

      {loading ? (
        <div style={overlayStyle}>
          <span style={{ color: palette.grey600, fontSize: 14, fontFamily: "system-ui, sans-serif" }}>Rendering sheet…</span>
        </div>
      ) : null}
      {error ? (
        <div style={overlayStyle}>
          <span style={{ color: palette.error600, fontSize: 14, fontFamily: "system-ui, sans-serif", padding: "0 24px", textAlign: "center" }}>
            {error}
          </span>
        </div>
      ) : null}
    </div>
  );
}
