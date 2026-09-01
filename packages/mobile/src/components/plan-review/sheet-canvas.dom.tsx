"use dom";

import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import * as pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs";
import { hitTestMarkup, MarkupLayer } from "./markup-svg";
import type {
  MarkupGeometry,
  MarkupPoint,
  MarkupRect,
  SheetMarkup,
  SheetRenderInfo,
  SheetTool,
} from "./markup-types";

// Metro cannot emit pdfjs's real Worker file, so preload the worker module on
// globalThis — pdfjs's fake-worker path finds WorkerMessageHandler there and
// parses on the main thread instead of spawning a Worker.
(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;

// pdfjs v6 needs Promise.withResolvers and Promise.try (ES2024/ES2025);
// WKWebView on older iOS lacks both.
if (typeof Promise.withResolvers !== "function") {
  Promise.withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}
if (typeof Promise.try !== "function") {
  Promise.try = function <T, U extends unknown[]>(
    callbackFn: (...args: U) => T | PromiseLike<T>,
    ...args: U
  ) {
    return new Promise<T>((resolve) => resolve(callbackFn(...args))) as Promise<Awaited<T>>;
  };
}

// pdfjs also uses the Uint8Array base64/hex proposal, still missing here.
interface U8Patch {
  toHex?: (this: Uint8Array) => string;
  toBase64?: (this: Uint8Array) => string;
}
const u8proto = Uint8Array.prototype as unknown as U8Patch;
if (typeof u8proto.toHex !== "function") {
  u8proto.toHex = function (this: Uint8Array) {
    let out = "";
    for (let i = 0; i < this.length; i++) out += this[i].toString(16).padStart(2, "0");
    return out;
  };
}
if (typeof u8proto.toBase64 !== "function") {
  u8proto.toBase64 = function (this: Uint8Array) {
    let bin = "";
    for (let i = 0; i < this.length; i++) bin += String.fromCharCode(this[i]);
    return btoa(bin);
  };
}
const u8ctor = Uint8Array as unknown as { fromBase64?: (b64: string) => Uint8Array };
if (typeof u8ctor.fromBase64 !== "function") {
  u8ctor.fromBase64 = (b64: string) => {
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  };
}

// …and the Map/WeakMap upsert proposal and URL.parse (Safari 18+).
interface MapPatch {
  getOrInsertComputed?: <K, V>(this: Map<K, V>, key: K, callback: (key: K) => V) => V;
}
const mapProto = Map.prototype as unknown as MapPatch;
if (typeof mapProto.getOrInsertComputed !== "function") {
  mapProto.getOrInsertComputed = function <K, V>(this: Map<K, V>, key: K, callback: (key: K) => V): V {
    if (!this.has(key)) this.set(key, callback(key));
    return this.get(key) as V;
  };
}
interface WeakMapPatch {
  getOrInsertComputed?: <K extends WeakKey, V>(this: WeakMap<K, V>, key: K, callback: (key: K) => V) => V;
}
const weakMapProto = WeakMap.prototype as unknown as WeakMapPatch;
if (typeof weakMapProto.getOrInsertComputed !== "function") {
  weakMapProto.getOrInsertComputed = function <K extends WeakKey, V>(
    this: WeakMap<K, V>,
    key: K,
    callback: (key: K) => V,
  ): V {
    if (!this.has(key)) this.set(key, callback(key));
    return this.get(key) as V;
  };
}
const urlCtor = URL as unknown as { parse?: (url: string, base?: string | URL) => URL | null };
if (typeof urlCtor.parse !== "function") {
  urlCtor.parse = (url, base) => {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  };
}
const mathObj = Math as Math & { sumPrecise?: (values: Iterable<number>) => number };
if (typeof mathObj.sumPrecise !== "function") {
  // Kahan-compensated sum stands in for the exact-summation proposal; pdfjs
  // only uses it for font metrics, where compensated precision is plenty.
  mathObj.sumPrecise = (values: Iterable<number>) => {
    let sum = 0;
    let compensation = 0;
    for (const value of values) {
      const t = sum + value;
      compensation += Math.abs(sum) >= Math.abs(value) ? sum - t + value : value - t + sum;
      sum = t;
    }
    return sum + compensation;
  };
}

const abProto = ArrayBuffer.prototype as unknown as {
  transferToFixedLength?: (this: ArrayBuffer, newByteLength?: number) => ArrayBuffer;
};
if (typeof abProto.transferToFixedLength !== "function") {
  // Copy-only stand-in: real transfer also detaches the source, so callers
  // never reuse it — skipping detachment is observably equivalent here.
  abProto.transferToFixedLength = function (this: ArrayBuffer, newByteLength?: number) {
    const length = newByteLength ?? this.byteLength;
    const out = new ArrayBuffer(length);
    new Uint8Array(out).set(new Uint8Array(this, 0, Math.min(length, this.byteLength)));
    return out;
  };
}

// iOS WKWebView refuses canvases past ~16.7M pixels; stay safely under.
const MAX_CANVAS_PIXELS = 14_000_000;
const BASE_SCALE = 1.6;
const DEFAULT_ASPECT = 0.775;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const TAP_SLOP_PX = 8;
const PEN_MIN_STEP_PCT = 0.35;

interface Transform {
  s: number;
  tx: number;
  ty: number;
}

interface Gesture {
  mode: "idle" | "pan" | "pinch" | "pen" | "cloud" | "tap";
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  startPct: MarkupPoint | null;
  pinchDist: number;
  pinchScale: number;
  pinchTx: number;
  pinchTy: number;
  pinchMidX: number;
  pinchMidY: number;
}

const IDLE_GESTURE: Gesture = {
  mode: "idle",
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  moved: false,
  startPct: null,
  pinchDist: 0,
  pinchScale: 1,
  pinchTx: 0,
  pinchTy: 0,
  pinchMidX: 0,
  pinchMidY: 0,
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export default function SheetCanvas({
  docKey,
  pdfBase64,
  imageDataUri,
  pageNo,
  markups,
  selectedId,
  tool,
  onCreate,
  onSelect,
  onRendered,
  dom: _dom,
}: {
  docKey: string;
  pdfBase64: string | null;
  imageDataUri: string | null;
  pageNo: number;
  markups: SheetMarkup[];
  selectedId: string | null;
  tool: SheetTool;
  onCreate: (geometry: MarkupGeometry) => Promise<void>;
  onSelect: (id: string | null) => Promise<void>;
  onRendered: (info: SheetRenderInfo) => Promise<void>;
  dom?: import("expo/dom").DOMProps;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docCache = useRef<{ key: string; doc: import("pdfjs-dist").PDFDocumentProxy } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture>({ ...IDLE_GESTURE });

  const [vpSize, setVpSize] = useState({ w: 0, h: 0 });
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const [transform, setTransform] = useState<Transform>({ s: 1, tx: 0, ty: 0 });
  const [draftPen, setDraftPen] = useState<MarkupPoint[] | null>(null);
  const [draftRect, setDraftRect] = useState<MarkupRect | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    setTransform({ s: 1, tx: 0, ty: 0 });
    setDraftPen(null);
    setDraftRect(null);
  }, [docKey, pageNo]);

  useEffect(
    () => () => {
      docCache.current?.doc.loadingTask.destroy().catch(() => undefined);
      docCache.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!pdfBase64 || imageDataUri) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      let entry = docCache.current;
      if (!entry || entry.key !== docKey) {
        const raw = atob(pdfBase64);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
        docCache.current?.doc.loadingTask.destroy().catch(() => undefined);
        entry = { key: docKey, doc };
        docCache.current = entry;
      }
      if (cancelled) return;

      const safePage = clamp(pageNo, 1, entry.doc.numPages);
      const page = await entry.doc.getPage(safePage);
      if (cancelled) return;

      const probe = page.getViewport({ scale: 1 });
      const scale = Math.min(BASE_SCALE, Math.sqrt(MAX_CANVAS_PIXELS / (probe.width * probe.height)));
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      if (cancelled) return;

      setAspect(viewport.height / viewport.width);
      setLoading(false);
      void onRendered({ aspect: viewport.height / viewport.width, pageCount: entry.doc.numPages });
    })().catch((err: unknown) => {
      if (cancelled) return;
      setLoading(false);
      setError(err instanceof Error ? err.message : "Could not render this sheet");
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey, pdfBase64, imageDataUri, pageNo]);

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

  function clampTransform(t: Transform): Transform {
    const vw = vpSize.w;
    const vh = vpSize.h;
    const w = box.w * t.s;
    const h = box.h * t.s;
    return {
      s: t.s,
      tx: clamp(t.tx, Math.min(0, vw - w), Math.max(0, vw - w)),
      ty: clamp(t.ty, Math.min(0, vh - h), Math.max(0, vh - h)),
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;

    if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()];
      const vp = viewportRef.current?.getBoundingClientRect();
      setDraftPen(null);
      setDraftRect(null);
      g.mode = "pinch";
      g.pinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      g.pinchScale = transform.s;
      g.pinchTx = transform.tx;
      g.pinchTy = transform.ty;
      g.pinchMidX = (p1.x + p2.x) / 2 - (vp?.left ?? 0);
      g.pinchMidY = (p1.y + p2.y) / 2 - (vp?.top ?? 0);
      return;
    }
    if (pointers.current.size !== 1) return;

    g.startX = g.lastX = e.clientX;
    g.startY = g.lastY = e.clientY;
    g.moved = false;
    g.startPct = pctFromClient(e.clientX, e.clientY);

    if (tool === "pen") {
      g.mode = "pen";
      setDraftPen(g.startPct ? [g.startPct] : []);
    } else if (tool === "cloud") {
      g.mode = "cloud";
      setDraftRect(null);
    } else if (tool === "pin") {
      g.mode = "tap";
    } else {
      g.mode = "pan";
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;

    if (Math.abs(e.clientX - g.startX) + Math.abs(e.clientY - g.startY) > TAP_SLOP_PX) g.moved = true;

    if (g.mode === "pinch" && pointers.current.size >= 2) {
      const [p1, p2] = [...pointers.current.values()];
      const vp = viewportRef.current?.getBoundingClientRect();
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (g.pinchDist <= 0) return;
      const s = clamp(g.pinchScale * (dist / g.pinchDist), MIN_ZOOM, MAX_ZOOM);
      const midX = (p1.x + p2.x) / 2 - (vp?.left ?? 0);
      const midY = (p1.y + p2.y) / 2 - (vp?.top ?? 0);
      const ratio = s / g.pinchScale;
      setTransform(
        clampTransform({
          s,
          tx: midX - ratio * (g.pinchMidX - g.pinchTx),
          ty: midY - ratio * (g.pinchMidY - g.pinchTy),
        }),
      );
      return;
    }

    if (g.mode === "pan") {
      const dx = e.clientX - g.lastX;
      const dy = e.clientY - g.lastY;
      g.lastX = e.clientX;
      g.lastY = e.clientY;
      setTransform((t) => clampTransform({ s: t.s, tx: t.tx + dx, ty: t.ty + dy }));
      return;
    }

    if (g.mode === "pen") {
      const pt = pctFromClient(e.clientX, e.clientY);
      if (!pt) return;
      setDraftPen((prev) => {
        if (!prev) return prev;
        const last = prev[prev.length - 1];
        if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < PEN_MIN_STEP_PCT) return prev;
        return [...prev, pt];
      });
      return;
    }

    if (g.mode === "cloud" && g.startPct) {
      const pt = pctFromClient(e.clientX, e.clientY);
      if (!pt) return;
      setDraftRect({
        x: round2(Math.min(g.startPct.x, pt.x)),
        y: round2(Math.min(g.startPct.y, pt.y)),
        w: round2(Math.abs(pt.x - g.startPct.x)),
        h: round2(Math.abs(pt.y - g.startPct.y)),
      });
    }
  }

  function finishSinglePointer(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;

    if (g.mode === "pen") {
      setDraftPen((points) => {
        if (points && points.length >= 2) void onCreate({ kind: "pen", points });
        return null;
      });
    } else if (g.mode === "cloud") {
      setDraftRect((rect) => {
        if (rect && rect.w >= 1 && rect.h >= 1) void onCreate({ kind: "cloud", rect });
        return null;
      });
    } else if (g.mode === "tap" && !g.moved) {
      const pt = pctFromClient(e.clientX, e.clientY);
      if (pt) void onCreate({ kind: "pin", at: pt });
    } else if (g.mode === "pan" && !g.moved) {
      const pt = pctFromClient(e.clientX, e.clientY);
      if (pt) {
        const hit = hitTestMarkup(
          markups,
          { x: (pt.x / 100) * box.w, y: (pt.y / 100) * box.h },
          box.w,
          box.h,
          24 / transform.s,
        );
        void onSelect(hit);
      }
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;

    if (g.mode === "pinch") {
      if (pointers.current.size === 1) {
        const [rest] = [...pointers.current.values()];
        g.mode = "pan";
        g.lastX = rest.x;
        g.lastY = rest.y;
        g.moved = true;
      } else if (pointers.current.size === 0) {
        g.mode = "idle";
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
        background: "#EDEDED",
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
          background: "#FFFFFF",
        }}
      >
        {imageDataUri ? (
          <img
            src={imageDataUri}
            alt="Plan sheet"
            draggable={false}
            style={{ width: "100%", height: "100%", display: "block" }}
            onLoad={(e) => {
              const el = e.currentTarget;
              if (el.naturalWidth > 0) {
                const nextAspect = el.naturalHeight / el.naturalWidth;
                setAspect(nextAspect);
                setLoading(false);
                void onRendered({ aspect: nextAspect, pageCount: 1 });
              }
            }}
          />
        ) : (
          <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
        )}
        <MarkupLayer
          markups={markups}
          draftPen={draftPen}
          draftRect={draftRect}
          width={box.w}
          height={box.h}
          selectedId={selectedId}
        />
      </div>

      {loading ? (
        <div style={overlayStyle}>
          <span style={{ color: "#5C5C5C", fontSize: 14, fontFamily: "system-ui, sans-serif" }}>Rendering sheet…</span>
        </div>
      ) : null}
      {error ? (
        <div style={overlayStyle}>
          <span style={{ color: "#B3261E", fontSize: 14, fontFamily: "system-ui, sans-serif", padding: "0 24px", textAlign: "center" }}>
            {error}
          </span>
        </div>
      ) : null}
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.85)",
};
