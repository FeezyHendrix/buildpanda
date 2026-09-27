// Re-scaling a drawing, and redrawing the regions of it that carry their own scale.
//
// A sheet's scale is the one input every figure on it depends on: correcting
// 1:100 to 1:50 doubles every run and quadruples every area taken against it.
// That makes a calibration unlike any other edit — it restates lines nobody
// opened. So it is shown in full before it is committed, it lands under the
// same session lock as a redraw, every line it moves loses its sign-off, and
// the apply is bound to the preview that was shown (see
// editor-calibration-preview.ts).
//
// Three things are deliberately left alone. A count is marks on a sheet, not a
// dimension, so no scale multiplies it. A drawing MEASURED at a viewport's own
// scale records that, and the sheet scale never applied to it — which is read
// off the stored binding, never re-derived from where the shape now sits. And a
// line whose tool cannot be established blocks the whole apply rather than
// being guessed: a wrong guess does not fail, it produces a smaller number on a
// priced line that still looks measured.

import { BadRequestError, ConflictError, NotFoundError } from "../../../lib/errors.ts";
import { num } from "./dto.ts";
import {
  assertPreviewStillHolds,
  assertScale,
  previewOf,
  scanCalibration,
  type RowAtScale,
} from "./editor-calibration-preview.ts";
import { assertOperationLimits } from "./editor-repository.ts";
import { amountFor } from "./editor-row-recompute.ts";
import { storedBinding } from "./editor-scale-binding.ts";
import type { CalibrationReadContext, CalibrationWriteContext } from "./editor-unit-of-work.ts";
import { record } from "./editor-writers.ts";
import { basisFor } from "./measurement-basis.ts";
import { netQuantity } from "./measurements.ts";
import { reviewResetPatch } from "./review-policy.ts";
import { scaleLabel } from "./viewports.ts";
import type {
  ApplyCalibrationBody,
  CalibrationPreview,
  CalibrationPreviewBody,
  CalibrationReceipt,
  CalibrationReceiptRow,
  Deduction,
  PreconBoqRowRow,
  PreconGeometryRow,
  PreconSheetRow,
  SheetCalibration,
} from "./types.ts";

const STALE_ROW = "A line on this sheet changed while it was being re-calibrated; refresh and reapply";

async function requireSheetAt(
  ctx: CalibrationReadContext,
  sheetId: string,
  expectedVersion: number,
): Promise<PreconSheetRow> {
  const sheet = await ctx.sheets.sheetById(sheetId);
  if (!sheet) throw new NotFoundError("Sheet");
  const current = sheet.version ?? 1;
  if (current !== expectedVersion) {
    throw new ConflictError(`Sheet was re-calibrated by someone else (current version ${current}); refresh and reapply`);
  }
  return sheet;
}

export async function previewCalibration(
  ctx: CalibrationReadContext,
  sheetId: string,
  body: CalibrationPreviewBody,
): Promise<CalibrationPreview> {
  const mmPerPt = assertScale(body.newScaleMmPerPt);
  const sheet = await requireSheetAt(ctx, sheetId, body.version);
  return previewOf(await scanCalibration(ctx, sheet.session_id, sheet, mmPerPt));
}

function unresolvedMessage(rowIds: string[]): string {
  return (
    `${rowIds.length} line${rowIds.length === 1 ? "" : "s"} on this drawing cannot be re-measured at a new scale ` +
    "because nothing records how they were measured. Confirm the tool, factor and unit on each, then re-scale. " +
    `Unresolved: ${rowIds.slice(0, 10).join(", ")}`
  );
}

/** True when a re-scale leaves this line exactly as it found it, openings included. */
function unchangedBy(row: PreconBoqRowRow, gross: number, net: number, deductions: Deduction[]): boolean {
  const before = row.deductions ?? [];
  return (
    num(row.qty_gross) === gross &&
    num(row.qty) === net &&
    before.length === deductions.length &&
    before.every((entry, index) => {
      const next = deductions[index];
      return next !== undefined && next.qty === entry.qty && next.unit === entry.unit;
    })
  );
}

/** The binding a moved shape now records: same source, the sheet's new figures. */
function reboundDefinition(shape: PreconGeometryRow, sheet: PreconSheetRow, mmPerPt: number): unknown {
  const definition = shape.definition;
  if (typeof definition !== "object" || definition === null) return definition;
  const binding = storedBinding(definition);
  if (!binding || binding.source !== "sheet") return definition;
  return { ...definition, scale: { ...binding, sheetVersion: sheet.version ?? 1, appliedMmPerPt: mmPerPt } };
}

async function writeRow(
  ctx: CalibrationWriteContext,
  sessionId: string,
  sheet: PreconSheetRow,
  entry: RowAtScale,
  mmPerPt: number,
  actor: string,
): Promise<CalibrationReceiptRow> {
  // The scan already re-cut the openings against each one's own parent, under
  // this same lock. Recomputing them here is how a preview and an apply drift.
  const { deductions, cuts } = entry;
  const typical = entry.row.typical ?? 1;
  const net = netQuantity(entry.gross, deductions, typical);
  const head = `Re-calibrated to ${scaleLabel(sheet, mmPerPt)}; ${entry.contributions.length} measurement${
    entry.contributions.length === 1 ? "" : "s"
  }; gross ${entry.gross} ${entry.unit ?? ""}`.trim();

  // Re-applying the scale a drawing already has moves no figure, so it is not a
  // new measurement: writing anyway would bump the version and strip a
  // verifier's name off a line whose quantity never changed.
  if (unchangedBy(entry.row, entry.gross, net, deductions)) {
    return {
      rowId: entry.row.id,
      version: entry.row.version,
      qtyGross: num(entry.row.qty_gross),
      qty: num(entry.row.qty),
    };
  }

  const updated = await ctx.rows.updateRowVersioned(entry.row.id, entry.row.version, {
    qty_gross: entry.gross,
    qty: net,
    ...(entry.unit === null ? {} : { unit: entry.unit }),
    deductions,
    measurement_basis: basisFor({ basis: head, gross: entry.gross, deductions, typical, net, unit: entry.unit }),
    amount: amountFor(entry.row, net),
    ...reviewResetPatch(),
  });
  if (!updated) throw new ConflictError(STALE_ROW);

  // Every shape this calibration re-measured is rewritten with the figure it now
  // carries AND the sheet version that figure is true for.
  const byId = new Map(entry.contributions.map((contribution) => [contribution.geometryId, contribution]));
  for (const geometryId of entry.movedGeometryIds) {
    const contribution = byId.get(geometryId);
    if (!contribution) continue;
    const shape = await ctx.geometries.geometryById(geometryId);
    await ctx.geometries.updateGeometryMeasurement(geometryId, {
      quantity: contribution.gross,
      unit: contribution.unit,
      ...(shape ? { definition: reboundDefinition(shape, sheet, mmPerPt) } : {}),
    });
  }
  for (const cut of cuts) {
    await ctx.geometries.updateGeometryMeasurement(cut.geometryId, { quantity: cut.qty, unit: cut.unit });
  }

  ctx.emit({
    type: "geometry.updated",
    sessionId,
    rowId: updated.id,
    version: updated.version,
    actor,
    changes: { qty: net, qtyGross: entry.gross },
  });
  return { rowId: updated.id, version: updated.version, qtyGross: num(updated.qty_gross), qty: num(updated.qty) };
}

export async function applyCalibrationIn(
  ctx: CalibrationWriteContext,
  sessionId: string,
  sheetId: string,
  body: ApplyCalibrationBody,
  actor: string,
): Promise<CalibrationReceipt> {
  const mmPerPt = assertScale(body.newScaleMmPerPt);
  const sheet = await ctx.sheets.lockSheet(sheetId, body.version);
  if (sheet.session_id !== sessionId) throw new NotFoundError("Sheet");

  // Re-stating the scale already in force changes nothing, so it writes nothing.
  // The version check above still ran — a caller asserting a state gets told if
  // it has moved — but past here every write is a lie about an event: a
  // `calibration` record for a re-calibration nobody performed, a version bump
  // that hands every other client a spurious 409, and `reviewResetPatch`
  // withdrawing the sign-off from every line on the drawing. A retry of a save
  // that already landed is the ordinary way this happens, so it answers with the
  // current state rather than an error.
  if (sheet.scale_mm_per_pt !== null && Number(sheet.scale_mm_per_pt) === mmPerPt) {
    return { sheetId, version: sheet.version ?? 1, scaleMmPerPt: mmPerPt, rows: [], unresolved: [], unresolvedCount: 0 };
  }

  // The same scan the preview ran, re-run under the lock. If it no longer
  // fingerprints the same, the drawing moved after the QS approved the figures.
  const scan = await scanCalibration(ctx, sessionId, sheet, mmPerPt);
  assertPreviewStillHolds(scan, body.previewToken);

  assertOperationLimits({
    rowIds: scan.affected.map((entry) => entry.row.id),
    geometryIds: [],
    sheetIds: [sheetId],
    markupIds: [],
  });

  // Contract 12: an unresolved line BLOCKS the apply. It used to be collected and
  // reported while the sheet was re-scaled anyway, which is the worst of both
  // outcomes — the drawing now says 1:50 and that line still carries a figure
  // measured at 1:100, with nothing on the row to say so.
  if (scan.unresolvedRowIds.length > 0) throw new BadRequestError(unresolvedMessage(scan.unresolvedRowIds));

  const calibration: SheetCalibration = {
    enteredDistance: body.reference?.enteredDistance ?? null,
    unit: body.reference?.unit ?? null,
    mmPerPt,
    actor,
    time: new Date().toISOString(),
    ...(body.reference ? { fromPt: body.reference.fromPt, toPt: body.reference.toPt } : {}),
  };
  const updatedSheet = await ctx.sheets.applyCalibration(sheetId, { scaleMmPerPt: mmPerPt, calibration });

  const rows: CalibrationReceiptRow[] = [];
  for (const entry of scan.affected) {
    rows.push(await writeRow(ctx, sessionId, updatedSheet, entry, mmPerPt, actor));
  }

  await record(
    ctx,
    sessionId,
    null,
    actor,
    "sheet_recalibrated",
    { sheetId, scaleMmPerPt: sheet.scale_mm_per_pt, version: sheet.version ?? 1 },
    { sheetId, scaleMmPerPt: mmPerPt, version: updatedSheet.version ?? 1, rows: rows.length, unresolved: [] },
    body.operationId,
  );

  return {
    sheetId,
    version: updatedSheet.version ?? 1,
    scaleMmPerPt: mmPerPt,
    rows,
    unresolved: [],
    unresolvedCount: 0,
  };
}

export { applyViewportsIn, previewViewports } from "./editor-viewport-apply.ts";
