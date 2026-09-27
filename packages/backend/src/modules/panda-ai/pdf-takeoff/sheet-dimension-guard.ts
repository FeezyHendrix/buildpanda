// The old sheet PATCH may not move a dimension out from under a measurement.
//
// `PATCH /precon/sheets/:sheetId` predates the editor. It writes the scale and
// the viewports straight onto the pool: no session lock, no preview, and no
// recompute of the lines that were measured against them. On an uncalibrated
// drawing that is harmless — there is nothing to restate. On a measured one it
// is the worst kind of error: every figure on the sheet silently becomes wrong
// while the bill still reads as measured and signed off, and nothing in the
// audit trail says a scale moved.
//
// So a dimensional change to a drawing that carries measurements is refused
// here and pointed at the path that does it safely — preview the effect, then
// apply it as one locked, audited, reversible operation (contract 12).
//
// Non-dimensional corrections (the title, the sheet kind) are untouched:
// renaming a drawing is not a re-measurement.

import { BadRequestError } from "../../../lib/errors.ts";
import type { PreconGeometryRow, PreconSheetRow, SheetViewport, UpdateSheetBody } from "./types.ts";

export interface SheetMeasurementReader {
  geometriesBySheet(sheetId: string): PromiseLike<PreconGeometryRow[]>;
}

const CALIBRATION_PATH =
  "Preview it on the drawing first (POST /precon/sheets/:sheetId/calibration-preview), then apply the calibration as an " +
  "editor operation so every line it restates is recomputed, audited and reversible together.";

const VIEWPORT_PATH =
  "Change the scale regions through an editor operation (apply-viewports), which shows what it does to the measurements " +
  "taken inside them and records the change as one reversible receipt.";

const sameViewports = (before: SheetViewport[], after: NonNullable<UpdateSheetBody["viewports"]>): boolean =>
  before.length === after.length &&
  before.every((viewport, index) => {
    const next = after[index];
    return (
      next !== undefined &&
      next.id === viewport.id &&
      next.label === viewport.label &&
      next.scaleMmPerPt === viewport.scaleMmPerPt &&
      next.rect.every((value, axis) => value === viewport.rect[axis])
    );
  });

/**
 * Refuses a scale or viewport change that would restate saved figures without
 * restating them. First-time calibration stays open: a sheet with no scale
 * cannot have had anything measured against one.
 */
export async function assertDimensionChangeIsSafe(
  reader: SheetMeasurementReader,
  sheet: PreconSheetRow,
  body: UpdateSheetBody,
): Promise<void> {
  const movesScale =
    body.scaleMmPerPt !== undefined && sheet.scale_mm_per_pt !== null && body.scaleMmPerPt !== sheet.scale_mm_per_pt;
  const movesRegions = body.viewports !== undefined && !sameViewports(sheet.viewports ?? [], body.viewports);
  if (!movesScale && !movesRegions) return;

  const measured = await reader.geometriesBySheet(sheet.id);
  if (measured.length === 0) return;

  if (movesScale) {
    throw new BadRequestError(
      `${measured.length} measurement${measured.length === 1 ? " was" : "s were"} taken at this drawing's current scale, ` +
        `so changing it here would leave ${measured.length === 1 ? "it" : "them"} reading a figure nobody measured. ` +
        CALIBRATION_PATH,
    );
  }
  throw new BadRequestError(
    `${measured.length} measurement${measured.length === 1 ? " was" : "s were"} taken on this drawing, and its scale ` +
      `regions are part of what produced ${measured.length === 1 ? "that figure" : "those figures"}. ` +
      VIEWPORT_PATH,
  );
}
