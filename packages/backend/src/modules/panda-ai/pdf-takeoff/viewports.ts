import { BadRequestError } from "../../../lib/errors.ts";
import { generateId } from "../../../lib/ids.ts";
import type { ScalePick, SheetViewport, SheetViewportInput } from "./types.ts";

// A details sheet carries several scales: a plan at 1:100 with a 1:20 detail
// beside it. Each viewport is a rectangle of the sheet with its own
// mm-per-point; a drawing whose first vertex lands inside one is measured
// at that scale, everything else at the sheet's.

// PDF points are 1/72 in; "1:n" is how a drawing states its scale
const MM_PER_PDF_PT = 25.4 / 72;
const MAX_VIEWPORTS = 50;

type ScaledSheet = { scale_mm_per_pt: number | null; viewports?: SheetViewport[] | null; file_name?: string };

/** Validates and normalises the viewports a reviewer drew; rects come back as [minX, minY, maxX, maxY]. */
export function normaliseViewports(input: SheetViewportInput[]): SheetViewport[] {
  if (input.length > MAX_VIEWPORTS) throw new BadRequestError(`A sheet holds at most ${MAX_VIEWPORTS} viewports`);
  const seen = new Set<string>();
  return input.map((v) => {
    const label = v.label.trim();
    if (!label) throw new BadRequestError("Every viewport needs a label");
    if (!Array.isArray(v.rect) || v.rect.length !== 4 || v.rect.some((n) => !Number.isFinite(n))) {
      throw new BadRequestError(`Viewport "${label}" needs a rect of four numbers`);
    }
    const [x1, y1, x2, y2] = v.rect;
    const rect: SheetViewport["rect"] = [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
    if (rect[2] - rect[0] <= 0 || rect[3] - rect[1] <= 0) throw new BadRequestError(`Viewport "${label}" has no area`);
    if (!(Number.isFinite(v.scaleMmPerPt) && v.scaleMmPerPt > 0)) throw new BadRequestError(`Viewport "${label}" needs a positive scale`);
    const id = v.id?.trim() || generateId("vp");
    if (seen.has(id)) throw new BadRequestError(`Viewport id ${id} is used twice`);
    seen.add(id);
    return { id, label, rect, scaleMmPerPt: v.scaleMmPerPt };
  });
}

function contains(rect: SheetViewport["rect"], x: number, y: number): boolean {
  return x >= rect[0] && x <= rect[2] && y >= rect[1] && y <= rect[3];
}

const area = (r: SheetViewport["rect"]): number => (r[2] - r[0]) * (r[3] - r[1]);

/** The viewport a point falls in; the smallest wins when they nest. */
export function viewportAt(viewports: SheetViewport[] | null | undefined, x: number, y: number): SheetViewport | null {
  let best: SheetViewport | null = null;
  for (const v of viewports ?? []) {
    if (!contains(v.rect, x, y)) continue;
    if (!best || area(v.rect) < area(best.rect)) best = v;
  }
  return best;
}

/**
 * The scale a drawing is measured at: the viewport holding its first vertex,
 * else the sheet scale. A sheet with neither cannot turn points into metres.
 */
export function scaleAt(sheet: ScaledSheet, vertices: number[][]): ScalePick {
  const first = vertices[0];
  const viewport = first ? viewportAt(sheet.viewports, first[0]!, first[1]!) : null;
  if (viewport) return { mmPerPt: viewport.scaleMmPerPt, viewport };
  if (!sheet.scale_mm_per_pt) throw new BadRequestError("Set the sheet scale first");
  return { mmPerPt: sheet.scale_mm_per_pt, viewport: null };
}

/** "1:20" on a PDF sheet; a DWG or a picture has no paper scale, so the ratio is stated as mm per unit. */
export function scaleLabel(sheet: { file_name?: string }, mmPerPt: number): string {
  if (sheet.file_name && /\.pdf$/i.test(sheet.file_name)) return `1:${Math.round(mmPerPt / MM_PER_PDF_PT)}`;
  return `${Math.round(mmPerPt * 1000) / 1000} mm per unit`;
}

/** The basis fragment naming the viewport a drawing was measured in, or nothing. */
export function scaleClause(sheet: { file_name?: string }, pick: ScalePick): string {
  return pick.viewport ? ` in viewport ${pick.viewport.label} at ${scaleLabel(sheet, pick.mmPerPt)}` : "";
}
