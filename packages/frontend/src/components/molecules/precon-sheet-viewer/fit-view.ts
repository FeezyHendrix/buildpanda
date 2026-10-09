import { BASE_RASTER } from "./use-sheet-loader";
import { FIT_VIEW, MAX_ZOOM, MIN_ZOOM, type SheetView } from "./use-sheet-view";

/** The sheet is inset from the pane edges so its border and the floating bars do not sit on the drawing. */
const FIT_FRACTION = 0.94;

export interface FitContent {
  widthPx: number;
  heightPx: number;
  rasterScale: number;
}

export interface FitBox {
  width: number;
  height: number;
}

/**
 * The view that puts the WHOLE sheet inside the pane.
 *
 * `userZoom: 1` is 100 %, not a fit: on a 1140×840 raster in a 720×505 pane it
 * leaves roughly 40 % of the drawing — including the lower half where a sheet's
 * measurements often sit — outside the visible area and out of the mouse's
 * reach. The rendered size is `widthPx × cssZoom` where
 * `cssZoom = BASE_RASTER × userZoom / rasterScale`, so the zoom that fits is
 * the smaller of the two axis ratios, converted back through that relation and
 * clamped to the zoom limits. The remainder is split evenly to centre it.
 */
export function fitViewFor(content: FitContent | null, box: FitBox | null): SheetView {
  if (!content || !box) return FIT_VIEW;
  const { widthPx, heightPx, rasterScale } = content;
  if (!(widthPx > 0) || !(heightPx > 0) || !(rasterScale > 0)) return FIT_VIEW;
  if (!(box.width > 0) || !(box.height > 0)) return FIT_VIEW;

  const wantedCssZoom = Math.min(box.width / widthPx, box.height / heightPx) * FIT_FRACTION;
  const userZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (wantedCssZoom * rasterScale) / BASE_RASTER));
  const cssZoom = (BASE_RASTER * userZoom) / rasterScale;
  const view: SheetView = {
    userZoom,
    tx: (box.width - widthPx * cssZoom) / 2,
    ty: (box.height - heightPx * cssZoom) / 2,
  };
  return Number.isFinite(view.tx) && Number.isFinite(view.ty) && Number.isFinite(view.userZoom) ? view : FIT_VIEW;
}
