import { useCallback, type RefObject } from "react";
import { BASE_RASTER, type PageInfo } from "./use-sheet-loader";
import type { SheetView } from "./use-sheet-view";

const SNAP_PX = 10;

interface Args {
  page: PageInfo | null;
  view: SheetView;
  containerRef: RefObject<HTMLDivElement | null>;
  /** The sheet's snap index (line ends and intersections) in sheet points. */
  snapPoints: number[][];
}

/**
 * The three coordinate spaces of the viewer and the maps between them:
 * screen (client px) → canvas px (the rasterised sheet) → sheet points.
 * A PDF point is a pdf.js point (y up from the page bottom); a DWG point is a
 * drawing unit read through the SVG frame, so the sheet's 1 mm/unit scale,
 * the snap index and the engine's evidence all share one space.
 */
export function useSheetCoords({ page, view, containerRef, snapPoints }: Args) {
  const cssZoom = page ? (BASE_RASTER * view.userZoom) / page.rasterScale : view.userZoom;

  const toPx = useCallback(
    (pt: number[]): [number, number] => {
      const frame = page?.frame;
      if (frame && page) return [((pt[0]! - frame.x) / frame.w) * page.widthPx, ((-pt[1]! - frame.y) / frame.h) * page.heightPx];
      const rs = page?.rasterScale ?? BASE_RASTER;
      return [pt[0]! * rs, page!.heightPx - pt[1]! * rs];
    },
    [page],
  );

  const toPt = useCallback(
    (pxX: number, pxY: number): [number, number] => {
      const frame = page?.frame;
      if (frame && page) return [frame.x + (pxX / page.widthPx) * frame.w, -(frame.y + (pxY / page.heightPx) * frame.h)];
      const rs = page?.rasterScale ?? BASE_RASTER;
      return [pxX / rs, (page!.heightPx - pxY) / rs];
    },
    [page],
  );

  const screenToCanvas = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const container = containerRef.current;
      if (!container || !page) return null;
      const rect = container.getBoundingClientRect();
      return [(clientX - rect.left - view.tx) / cssZoom, (clientY - rect.top - view.ty) / cssZoom];
    },
    [containerRef, page, view.tx, view.ty, cssZoom],
  );

  const screenToPt = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const canvasPt = screenToCanvas(clientX, clientY);
      return canvasPt ? toPt(canvasPt[0], canvasPt[1]) : null;
    },
    [screenToCanvas, toPt],
  );

  /** Snap to the nearest indexed point within ten screen pixels; Shift keeps the segment from `prev` orthogonal. */
  const snapAndOrtho = useCallback(
    (pt: [number, number], shift: boolean, prev: number[] | null): [number, number] => {
      let [x, y] = pt;
      const ptPerCanvasPx = page?.frame ? page.frame.w / page.widthPx : 1 / (page?.rasterScale ?? BASE_RASTER);
      const thresholdPt = (SNAP_PX / cssZoom) * ptPerCanvasPx;
      let best: number[] | null = null;
      let bestDist = thresholdPt;
      for (const p of snapPoints) {
        const d = Math.hypot(p[0]! - x, p[1]! - y);
        if (d < bestDist) {
          bestDist = d;
          best = p;
        }
      }
      if (best) [x, y] = [best[0]!, best[1]!];
      if (shift && prev) {
        if (Math.abs(x - prev[0]!) > Math.abs(y - prev[1]!)) y = prev[1]!;
        else x = prev[0]!;
      }
      return [x, y];
    },
    [page, cssZoom, snapPoints],
  );

  return { cssZoom, toPx, toPt, screenToCanvas, screenToPt, snapAndOrtho };
}
