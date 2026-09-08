import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export interface SheetView {
  tx: number;
  ty: number;
  userZoom: number;
}

export const FIT_VIEW: SheetView = { tx: 0, ty: 0, userZoom: 1 };
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 8;

function isFiniteView(v: SheetView): boolean {
  return Number.isFinite(v.tx) && Number.isFinite(v.ty) && Number.isFinite(v.userZoom) && v.userZoom > 0;
}

// Zoom about a fixed screen point. A non-finite input (a wheel event with no
// delta, state left behind by a hot reload) can never produce a NaN view: the
// result is checked and the viewer falls back to the fitted view instead.
function zoomAbout(v: SheetView, factor: number, cx: number, cy: number): SheetView {
  const base = isFiniteView(v) ? v : FIT_VIEW;
  if (!Number.isFinite(factor) || factor <= 0) return base;
  const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, base.userZoom * factor));
  if (newZoom === base.userZoom) return base;
  const ratio = newZoom / base.userZoom;
  const next = { userZoom: newZoom, tx: cx - (cx - base.tx) * ratio, ty: cy - (cy - base.ty) * ratio };
  return isFiniteView(next) ? next : FIT_VIEW;
}

/**
 * Pan and zoom state for the sheet canvas: toolbar buttons, prompt-driven
 * zoom requests, wheel and trackpad pinch (which must not zoom the browser
 * page, so the wheel listener is attached natively as non-passive), and
 * drag-to-pan while the select tool is active.
 */
export function useSheetView(containerRef: RefObject<HTMLDivElement | null>, panEnabled: boolean) {
  const [view, setViewRaw] = useState<SheetView>(FIT_VIEW);
  const setView = useCallback((update: SheetView | ((v: SheetView) => SheetView)) => {
    setViewRaw((v) => {
      const next = typeof update === "function" ? update(v) : update;
      return isFiniteView(next) ? next : FIT_VIEW;
    });
  }, []);
  const panRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const zoomBy = useCallback(
    (factor: number) => {
      const box = containerRef.current?.getBoundingClientRect();
      const cx = box ? box.width / 2 : 0;
      const cy = box ? box.height / 2 : 0;
      setView((v) => zoomAbout(v, factor, cx, cy));
    },
    [containerRef, setView],
  );
  const zoomFit = useCallback(() => setView(FIT_VIEW), [setView]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let pending = 0;
    let cursor: [number, number] = [0, 0];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onWheel = (e: WheelEvent) => {
      // the canvas owns the gesture: no page scroll, no browser pinch-zoom
      e.preventDefault();
      const delta = Number.isFinite(e.deltaY) ? e.deltaY : 0;
      // a pinch arrives as a ctrl+wheel with small deltas; scale it up so a
      // pinch feels like a wheel notch
      pending += e.ctrlKey ? delta * 3 : delta;
      const rect = container.getBoundingClientRect();
      cursor = [e.clientX - rect.left, e.clientY - rect.top];
      if (timer !== null) return;
      // coalesce a burst of wheel events into one state update per frame
      timer = setTimeout(() => {
        const d = pending;
        pending = 0;
        timer = null;
        if (d === 0) return;
        const [cx, cy] = cursor;
        setView((v) => zoomAbout(v, Math.pow(1.15, -d / 100), cx, cy));
      }, 16);
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
      if (timer !== null) clearTimeout(timer);
    };
  }, [containerRef, setView]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!panEnabled) return;
      panRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    },
    [panEnabled, view.tx, view.ty],
  );
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pan = panRef.current;
      if (!pan) return;
      setView((v) => ({ ...v, tx: pan.tx + e.clientX - pan.x, ty: pan.ty + e.clientY - pan.y }));
    },
    [setView],
  );
  const endPan = useCallback(() => {
    panRef.current = null;
  }, []);

  return { view, setView, zoomBy, zoomFit, onMouseDown, onMouseMove, endPan };
}
