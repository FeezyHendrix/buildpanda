// Re-pointing a recorded measurement at a different scale.
//
// `confirm-measurement-basis` states a basis that was never recorded.
// This CHANGES one that was — a detail traced against the sheet scale when it
// should have been read at the 1:20 region's — and that is a different act with
// a different risk: the figure will move. So it is explicit, it re-measures the
// whole line and every opening on it at the new scale, and it sends the line
// back for review whenever a number actually changed. Nothing about it is
// silent, which is the point: a scale correction that quietly restated a priced
// line would be indistinguishable from a mistake.
//
// It is deliberately NOT what a transform does. Moving a shape keeps the scale
// it records (see editor-scale-binding.ts); only this command changes it.

import { BadRequestError, ConflictError, NotFoundError } from "../../../lib/errors.ts";
import { num } from "./dto.ts";
import { recutDeductions } from "./editor-deduction-recut.ts";
import { amountFor, recomputeRow } from "./editor-row-recompute.ts";
import { pickScaleForNew, storedBinding, type ScaleChoice } from "./editor-scale-binding.ts";
import type { OperationWriteContext } from "./editor-unit-of-work.ts";
import { record, requireRow } from "./editor-write-helpers.ts";
import { tryResolveMeasureTool } from "./measurement-resolve.ts";
import { basisFor } from "./measurement-basis.ts";
import { netQuantity } from "./measurements.ts";
import { reviewPatchFor, measuredStateOf } from "./review-policy.ts";
import { scaleClause } from "./viewports.ts";
import type { PreconSheetRow } from "./types.ts";

export interface RebindBody {
  geometryId: string;
  rowId: string;
  scaleChoice: ScaleChoice;
  operationId?: string;
}

export async function rebindGeometryIn(
  ctx: OperationWriteContext,
  sessionId: string,
  body: RebindBody,
  actor: string,
): Promise<{ rowId: string; version: number; gross: number; qty: number }> {
  const row = await requireRow(ctx, body.rowId);
  const geometry = await ctx.geometries.geometryById(body.geometryId);
  if (!geometry || geometry.deleted_at || geometry.row_id !== body.rowId) throw new NotFoundError("Measurement");
  if (geometry.kind === "deduction") {
    throw new BadRequestError("An opening follows the scale of the measurement it is cut from; rebind that instead");
  }
  const sheet: PreconSheetRow | undefined = await ctx.sheets.sheetById(geometry.sheet_id);
  if (!sheet || sheet.session_id !== sessionId) throw new NotFoundError("Sheet");

  const resolved = tryResolveMeasureTool(geometry.definition ?? null);
  // A shape that records nothing has no binding to CHANGE; stating its basis for
  // the first time is `confirm-measurement-basis`, which is a different act.
  if (!resolved) {
    throw new BadRequestError(
      "This measurement records no basis, so there is nothing to re-point. Confirm its tool, factor and unit first.",
    );
  }
  const before = storedBinding(geometry.definition ?? null);
  const pick = pickScaleForNew(sheet, resolved.tool, geometry.vertices, body.scaleChoice);
  if (pick === null) {
    throw new BadRequestError("A count is a tally, not a dimension, so no scale applies to it");
  }

  const definition = {
    ...(geometry.definition as Record<string, unknown>),
    scale: pick.viewport
      ? { source: "viewport", viewportId: pick.viewport.id, sheetVersion: sheet.version ?? 1, appliedMmPerPt: pick.mmPerPt }
      : { source: "sheet", sheetVersion: sheet.version ?? 1, appliedMmPerPt: pick.mmPerPt },
  };
  await ctx.geometries.updateGeometryMeasurement(body.geometryId, { definition });

  // The whole line, from every shape on it, with its openings re-cut against
  // each one's own parent — the rebound shape included.
  const recomputed = await recomputeRow(ctx, row, sessionId);
  const recut = await recutDeductions({
    row,
    shapes: await ctx.geometries.geometriesByRow(row.id),
    sheetFor: async (id) => (id === sheet.id ? sheet : ((await ctx.sheets.sheetById(id)) ?? null)),
  });
  if (recut.unresolved) {
    throw new BadRequestError(
      "An opening on this line cannot be re-measured at the new scale because its own measurement records no basis. " +
        "Confirm that basis first.",
    );
  }
  const typical = row.typical ?? 1;
  const net = netQuantity(recomputed.gross, recut.deductions, typical);
  const head =
    `Re-pointed to ${pick.viewport ? `region ${pick.viewport.label}` : "the sheet scale"}` +
    `${scaleClause(sheet, pick)}; gross ${recomputed.gross} ${recomputed.unit}`;

  const state = measuredStateOf(row, resolved.factor);
  const updated = await ctx.rows.updateRowVersioned(body.rowId, row.version, {
    qty_gross: recomputed.gross,
    qty: net,
    unit: recomputed.unit,
    deductions: recut.deductions,
    amount: amountFor(row, net),
    measurement_basis: basisFor({
      basis: head,
      gross: recomputed.gross,
      deductions: recut.deductions,
      typical,
      net,
      unit: recomputed.unit,
    }),
    ...reviewPatchFor(row, state, { ...state, qty: net, gross: recomputed.gross, deductions: recut.deductions }),
  });
  if (!updated) throw new ConflictError("This line changed while it was being re-pointed; refresh and retry");

  for (const cut of recut.cuts) {
    await ctx.geometries.updateGeometryMeasurement(cut.geometryId, { quantity: cut.qty, unit: cut.unit });
  }
  for (const contribution of recomputed.contributions) {
    await ctx.geometries.updateGeometryMeasurement(contribution.geometryId, {
      quantity: contribution.base,
      unit: contribution.baseUnit,
    });
  }

  await record(
    ctx,
    sessionId,
    body.rowId,
    actor,
    "geometry_rebound",
    { geometryId: body.geometryId, scale: before, qtyGross: num(row.qty_gross), qty: num(row.qty), version: row.version },
    {
      geometryId: body.geometryId,
      scale: definition.scale,
      qtyGross: recomputed.gross,
      qty: net,
      version: updated.version,
    },
    body.operationId,
  );
  ctx.emit({
    type: "geometry.updated",
    sessionId,
    rowId: updated.id,
    version: updated.version,
    actor,
    changes: { qty: net, qtyGross: recomputed.gross },
  });
  return { rowId: updated.id, version: updated.version, gross: recomputed.gross, qty: net };
}
