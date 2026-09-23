// Changing a factor, not the drawing.
//
// A storey height comes off a section, a slab thickness off a detail — and
// both are routinely corrected days after the plan was traced. Asking a QS to
// redraw a 40-vertex wall run to change 2.7 m to 3.0 m invites a *different*
// drawing, which is a second, silent change to a signed-off quantity. So the
// stored vertices are re-measured with the new factor instead: the shape that
// was drawn is the shape that stays billed, and only the factor moves.
//
// Typical is the same act one level up — the run is unchanged, the number of
// identical floors it repeats on is not.

import { BadRequestError, ConflictError, NotFoundError } from "../../../lib/errors.ts";
import { num, toRow } from "./dto.ts";
import { assertDerivedFanout, derivedRowsIn } from "./editor-limits.ts";
import type { EditorWriteContext } from "./editor-unit-of-work.ts";
import { factorClause, isAnchorRow, recomputeDerivedRows, record, requireRow } from "./editor-writers.ts";
import { assemblySnapshotOf, measurementDefinition } from "./measurement-definition.ts";
import { amountFor, contributingShapes, recomputeRow } from "./editor-row-recompute.ts";
import { resolveMeasureTool } from "./measurement-resolve.ts";
import { basisFor } from "./measurement-basis.ts";
import { measureVertices, netQuantity, normaliseTypical } from "./measurements.ts";
import { labelsForTypical, repeatSettingsWith } from "./editor-repeat-writers.ts";
import { measuredStateOf, reviewPatchFor } from "./review-policy.ts";
import { mmPerPtOf, scaleClause, scaleForTool } from "./viewports.ts";
import type {
  EditDepthBody,
  EditHeightBody,
  EditTypicalBody,
  MeasureFactor,
  MeasureTool,
  PreconBoqRowDto,
} from "./types.ts";

const STALE = "Row changed since you loaded it; refresh and retry";

interface FactorEdit {
  tool: MeasureTool;
  noun: string;
  title: string;
  action: string;
  factor: (value: number) => MeasureFactor;
}

const HEIGHT: FactorEdit = {
  tool: "wall_area",
  noun: "height",
  title: "Height",
  action: "height_changed",
  factor: (heightM) => ({ heightM }),
};

const DEPTH: FactorEdit = {
  tool: "volume",
  noun: "depth",
  title: "Depth",
  action: "depth_changed",
  factor: (depthM) => ({ depthM }),
};

function isPriced(rowType: string): boolean {
  return rowType === "item" || rowType === "provisional_sum";
}

async function editFactorIn(
  ctx: EditorWriteContext,
  sessionId: string,
  rowId: string,
  edit: FactorEdit,
  value: number,
  version: number,
  operationId: string | undefined,
  actor: string,
): Promise<PreconBoqRowDto> {
  if (!Number.isFinite(value) || value <= 0) {
    throw new BadRequestError(`The ${edit.noun} must be a positive number of metres`);
  }
  const row = await requireRow(ctx, rowId);
  const geometry = await ctx.geometries.measurementGeometryForRow(rowId);
  if (!geometry) throw new BadRequestError(`Measure this line before changing its ${edit.noun}`);

  // Refuses rather than guesses, for the same reason a redraw does: a line
  // whose tool cannot be established would be re-billed at a figure the
  // factor never applied to.
  const { tool, factor: previous } = resolveMeasureTool(geometry.definition ?? null);
  if (tool !== edit.tool) {
    throw new BadRequestError(
      `Only a ${edit.tool.replace("_", " ")} line is billed through a ${edit.noun}; this one was measured as a ${tool.replace("_", " ")}`,
    );
  }

  const factor = edit.factor(value);
  // The height or depth belongs to the LINE, not to one of its shapes: a wall
  // drafted as three runs is one wall at one height. So every contributing shape
  // is rebound to the new factor, and only then is the line re-added — updating
  // the newest shape alone would bill part of the wall at the old height.
  const shapes = contributingShapes(await ctx.geometries.geometriesByRow(rowId));
  for (const shape of shapes) {
    const sheet = await ctx.sheets.sheetById(shape.sheet_id);
    if (!sheet || sheet.session_id !== sessionId) throw new NotFoundError("Sheet");
    const pick = scaleForTool(sheet, tool, shape.vertices);
    const remeasured = measureVertices(tool, shape.vertices, mmPerPtOf(pick), factor);
    await ctx.geometries.updateGeometryMeasurement(shape.id, {
      quantity: remeasured.base,
      unit: remeasured.baseUnit,
      definition: measurementDefinition(tool, shape.vertices, factor, sheet, pick, assemblySnapshotOf(shape.definition)),
    });
  }

  const sheet = await ctx.sheets.sheetById(geometry.sheet_id);
  if (!sheet || sheet.session_id !== sessionId) throw new NotFoundError("Sheet");
  const recomputed = await recomputeRow(ctx, row, sessionId);
  const unit = row.unit ?? recomputed.unit;
  const typical = row.typical ?? 1;
  const head = `${edit.title} set to ${value} m; ${shapes.length > 1 ? `${shapes.length} shapes` : `${recomputed.contributions[0]?.base} ${recomputed.contributions[0]?.baseUnit}`}${factorClause(tool, factor)}; gross ${recomputed.gross} ${unit}${scaleClause(sheet, scaleForTool(sheet, tool, geometry.vertices))}`;
  if (isAnchorRow(row)) assertDerivedFanout(derivedRowsIn(await ctx.rows.rowsBySession(sessionId)).length);

  const before = measuredStateOf(row, previous);
  const after = { ...measuredStateOf(row, factor), qty: recomputed.net, gross: recomputed.gross, unit };
  const updated = await ctx.rows.updateRowVersioned(rowId, version, {
    qty_gross: recomputed.gross,
    qty: recomputed.net,
    unit,
    // A fresh head carries no openings, so they are restated with it or they
    // leave the sentence while still coming off the figure.
    measurement_basis: basisFor({
      basis: head,
      gross: recomputed.gross,
      deductions: row.deductions ?? [],
      typical,
      net: recomputed.net,
      unit,
    }),
    amount: amountFor(row, recomputed.net),
    ...reviewPatchFor(row, before, after),
  });
  if (!updated) throw new ConflictError(STALE);

  await record(
    ctx,
    sessionId,
    rowId,
    actor,
    edit.action,
    { qty: num(row.qty), factor: { ...previous } },
    { qty: recomputed.net, gross: recomputed.gross, factor: { ...factor } },
    operationId,
  );
  ctx.emit({
    type: "geometry.updated",
    sessionId,
    rowId,
    version: updated.version,
    actor,
    changes: { qty: recomputed.net, qtyGross: recomputed.gross },
  });
  if (isAnchorRow(updated)) await recomputeDerivedRows(ctx, sessionId, actor);
  return toRow(updated);
}

export function editHeightIn(
  ctx: EditorWriteContext,
  sessionId: string,
  rowId: string,
  body: EditHeightBody,
  actor: string,
): Promise<PreconBoqRowDto> {
  return editFactorIn(ctx, sessionId, rowId, HEIGHT, body.heightM, body.version, body.operationId, actor);
}

export function editDepthIn(
  ctx: EditorWriteContext,
  sessionId: string,
  rowId: string,
  body: EditDepthBody,
  actor: string,
): Promise<PreconBoqRowDto> {
  return editFactorIn(ctx, sessionId, rowId, DEPTH, body.depthM, body.version, body.operationId, actor);
}

export async function editTypicalIn(
  ctx: EditorWriteContext,
  sessionId: string,
  rowId: string,
  body: EditTypicalBody,
  actor: string,
): Promise<PreconBoqRowDto> {
  const row = await requireRow(ctx, rowId);
  if (!isPriced(row.row_type)) throw new BadRequestError("Only priced rows repeat on typical floors");
  // throws on a fractional or zero multiplier: half a floor is a mistake, not a factor
  const typical = normaliseTypical(body.typical);
  const was = row.typical ?? 1;

  const gross = num(row.qty_gross) ?? num(row.qty) ?? 0;
  const net = netQuantity(gross, row.deductions ?? [], typical);
  // Re-sending the multiplier the line already carries moves no figure, so it
  // must not strip the sign-off or advance the version.
  if (typical === was) return toRow(row);

  // undefined = this line names no instances, so there is nothing to keep in step.
  const labels = labelsForTypical(row, typical);
  const before = measuredStateOf(row);
  const updated = await ctx.rows.updateRowVersioned(rowId, body.version, {
    typical,
    qty: net,
    measurement_basis: basisFor({
      basis: row.measurement_basis,
      gross,
      deductions: row.deductions ?? [],
      typical,
      net,
      unit: row.unit,
    }),
    ...(labels === undefined ? {} : { measurement_settings: repeatSettingsWith(row, labels) }),
    amount: amountFor(row, net),
    ...reviewPatchFor(row, before, { ...before, qty: net, typical }),
  });
  if (!updated) throw new ConflictError(STALE);

  await record(
    ctx,
    sessionId,
    rowId,
    actor,
    "typical_changed",
    { qty: num(row.qty), typical: was },
    { qty: net, typical },
    body.operationId,
  );
  ctx.emit({
    type: "row.updated",
    sessionId,
    rowId,
    version: updated.version,
    actor,
    changes: { typical, qty: net },
  });
  return toRow(updated);
}
