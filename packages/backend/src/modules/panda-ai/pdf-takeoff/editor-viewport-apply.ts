// Committing a change to a drawing's scale regions, and restating what it moves.
//
// This used to replace the set and stop. That is safe only if a region is
// decoration, and it is not: a shape drawn inside one is measured at THAT
// region's scale. So re-scaling a region from 1:20 to 1:10 left every figure
// taken in it stale on the bill, and the next unrelated edit to one of those
// lines silently re-added it at the new scale — a quantity jumping on an edit
// that had nothing to do with it, with nothing in the audit trail naming a
// scale change.
//
// So a region change now restates the lines it moves, in the same locked
// operation and the same receipt as the region itself, and the figures it
// writes are the ones the preview showed.
//
// Withdrawing a region is different and deliberately does NOT restate anything:
// those figures were taken at that region's scale and remain what was drawn.
// The binding simply names a region that no longer exists, which is a decision a
// person states rather than a side effect they discover.

import { BadRequestError, ConflictError, NotFoundError } from "../../../lib/errors.ts";
import { num } from "./dto.ts";
import { assertOperationLimits } from "./editor-repository.ts";
import { amountFor, recomputeRow } from "./editor-row-recompute.ts";
import type { CalibrationReadContext, CalibrationWriteContext } from "./editor-unit-of-work.ts";
import { scanViewports, viewportPreviewOf, type ScannedRow, type ViewportScan } from "./editor-viewport-impact.ts";
import { record } from "./editor-writers.ts";
import { basisFor } from "./measurement-basis.ts";
import { reviewResetPatch } from "./review-policy.ts";
import { normaliseViewports } from "./viewports.ts";
import type {
  ApplyViewportsBody,
  CalibrationReceiptRow,
  ViewportPreview,
  ViewportPreviewBody,
  ViewportsReceipt,
} from "./types.ts";

export const STALE_VIEWPORT_PREVIEW =
  "This drawing changed since the scale regions were previewed, so the figures you approved are no longer what would be " +
  "written. Refresh the preview and reapply.";

const STALE_ROW = "A line on this sheet changed while its scale region was being changed; refresh and reapply";

export async function previewViewports(
  ctx: CalibrationReadContext,
  sessionId: string,
  sheetId: string,
  body: ViewportPreviewBody,
): Promise<ViewportPreview> {
  const sheet = await ctx.sheets.sheetById(sheetId);
  if (!sheet || sheet.session_id !== sessionId) throw new NotFoundError("Sheet");
  const current = sheet.version ?? 1;
  if (current !== body.version) {
    throw new ConflictError(`Sheet was changed by someone else (current version ${current}); refresh and reapply`);
  }
  return viewportPreviewOf(await scanViewports(ctx, sessionId, sheet, normaliseViewports(body.viewports)));
}

function unresolvedRefusal(rowIds: string[]): string {
  return (
    `${rowIds.length} line${rowIds.length === 1 ? "" : "s"} measured in the regions this change touches cannot be ` +
    "re-measured, because nothing records how they were measured. Confirm the tool, factor and unit on each, then " +
    `change the regions. Unresolved: ${rowIds.slice(0, 10).join(", ")}`
  );
}

function withdrawalRefusal(scan: ViewportScan): string {
  const detail = scan.removed
    .map((region) => `${region.label} (${region.measurements.length} measurement${region.measurements.length === 1 ? "" : "s"})`)
    .join(", ");
  return (
    `Measurements were taken in ${scan.removed.length} region${scan.removed.length === 1 ? "" : "s"} this change ` +
    `removes: ${detail}. They keep the scale they were measured at. Confirm to proceed, or re-measure them first.`
  );
}

/**
 * One line written back exactly as the scan measured it — figure, re-cut
 * openings and all. The scan ran under this same lock, so re-deriving anything
 * here is how a preview and an apply drift apart.
 */
async function restate(
  ctx: CalibrationWriteContext,
  sessionId: string,
  entry: ScannedRow,
  actor: string,
): Promise<CalibrationReceiptRow> {
  const row = await ctx.rows.rowById(entry.rowId);
  if (!row) throw new ConflictError(STALE_ROW);
  const recomputed = await recomputeRow(ctx, row, sessionId);
  const typical = row.typical ?? 1;
  const head =
    `Re-measured after a scale region changed; ${recomputed.contributions.length} measurement` +
    `${recomputed.contributions.length === 1 ? "" : "s"}; gross ${entry.newQtyGross} ${entry.unit ?? ""}`.trim();

  const updated = await ctx.rows.updateRowVersioned(entry.rowId, row.version, {
    qty_gross: entry.newQtyGross,
    qty: entry.newQty,
    deductions: entry.deductions,
    ...(entry.unit === null ? {} : { unit: entry.unit }),
    amount: amountFor(row, entry.newQty),
    measurement_basis: basisFor({
      basis: head,
      gross: entry.newQtyGross,
      deductions: entry.deductions,
      typical,
      net: entry.newQty,
      unit: entry.unit,
    }),
    ...reviewResetPatch(),
  });
  if (!updated) throw new ConflictError(STALE_ROW);

  for (const contribution of recomputed.contributions) {
    await ctx.geometries.updateGeometryMeasurement(contribution.geometryId, {
      quantity: contribution.base,
      unit: contribution.baseUnit,
    });
  }
  for (const cut of entry.cuts) {
    await ctx.geometries.updateGeometryMeasurement(cut.geometryId, { quantity: cut.qty, unit: cut.unit });
  }

  ctx.emit({
    type: "geometry.updated",
    sessionId,
    rowId: updated.id,
    version: updated.version,
    actor,
    changes: { qty: entry.newQty, qtyGross: entry.newQtyGross },
  });
  return { rowId: updated.id, version: updated.version, qtyGross: num(updated.qty_gross), qty: num(updated.qty) };
}

export async function applyViewportsIn(
  ctx: CalibrationWriteContext,
  sessionId: string,
  sheetId: string,
  body: ApplyViewportsBody,
  actor: string,
): Promise<ViewportsReceipt> {
  const sheet = await ctx.sheets.lockSheet(sheetId, body.version);
  if (sheet.session_id !== sessionId) throw new NotFoundError("Sheet");
  const viewports = normaliseViewports(body.viewports);

  // The same scan the preview ran, re-run under the lock.
  const scan = await scanViewports(ctx, sessionId, sheet, viewports);
  if (body.previewToken !== undefined && body.previewToken !== scan.token) {
    throw new ConflictError(STALE_VIEWPORT_PREVIEW);
  }
  if (scan.removed.length > 0 && body.confirmed !== true) throw new BadRequestError(withdrawalRefusal(scan));

  // A line this change would move but which cannot be re-measured stops the
  // whole change. Applying it would restate its neighbours and leave this one
  // carrying a figure taken at a scale the drawing no longer has, with nothing
  // on the row to say so (contracts 12 and 22).
  if (scan.unresolvedRowIds.length > 0) throw new BadRequestError(unresolvedRefusal(scan.unresolvedRowIds));

  assertOperationLimits({
    rowIds: scan.rescaled.map((entry) => entry.rowId),
    geometryIds: [],
    sheetIds: [sheetId],
    markupIds: [],
  });

  const updated = await ctx.sheets.replaceViewports(sheetId, viewports);
  const rows: CalibrationReceiptRow[] = [];
  for (const entry of scan.rescaled) rows.push(await restate(ctx, sessionId, entry, actor));

  await record(
    ctx,
    sessionId,
    null,
    actor,
    "viewports_updated",
    { sheetId, viewports: sheet.viewports ?? [], version: sheet.version ?? 1 },
    {
      sheetId,
      viewports,
      version: updated.version ?? 1,
      restated: rows.length,
      withdrawn: scan.removed.map((region) => region.viewportId),
    },
    body.operationId,
  );
  return { sheetId, version: updated.version ?? 1, viewports, rows };
}
