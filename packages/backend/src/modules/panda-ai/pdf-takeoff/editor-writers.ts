// The editor's write logic, running against a transaction-bound context.
//
// `geometry-service` and `manual-service` still serve the non-editor paths (the
// assistant, the assembly measure, the import), where each write stands alone.
// The editor is different: one gesture restates the bill line, its geometry,
// the derived lines built off it and the audit trail, and a crash between those
// statements leaves a quantity with no measurement behind it. So the same
// measurement logic is re-run here against the repositories the unit of work
// hands it — delegating to the pooled services instead would put the writes
// back on separate connections, outside the lock, which is the split the seam
// exists to prevent.

import { BadRequestError, ConflictError, NotFoundError } from "../../../lib/errors.ts";
import { generateId } from "../../../lib/ids.ts";
import { num, toGeometry, toRow } from "./dto.ts";
import { assertDerivedFanout, derivedRowsIn } from "./editor-limits.ts";
import type { EditorWriteContext } from "./editor-unit-of-work.ts";
import {
  factorClause,
  isAnchorRow,
  recomputeDerivedRows,
  record,
  requireRow,
  requireSheet,
  targetBill,
} from "./editor-write-helpers.ts";

export { factorClause, isAnchorRow, recomputeDerivedRows, record, requireRow } from "./editor-write-helpers.ts";
import { assemblySnapshotOf, measurementDefinitionOfShape } from "./measurement-definition.ts";
import { deriveShape, measureShape, resolveShape } from "./measurement-shape.ts";
import { amountFor, contributingShapes, recomputeRow } from "./editor-row-recompute.ts";
import { resolveMeasureTool, tryResolveMeasureTool } from "./measurement-resolve.ts";
import { basisFor } from "./measurement-basis.ts";
import {
  GEOMETRY_KIND_BY_TOOL,
  manualBasis,
  netQuantity,
  normaliseTypical,
  validateGeometry,
} from "./measurements.ts";
import { measuredStateOf, reviewPatchFor } from "./review-policy.ts";
import { boundScale, pickScaleForNew } from "./editor-scale-binding.ts";
import { mmPerPtOf, scaleClause, scaleForTool } from "./viewports.ts";
import type {
  CreateMeasurementBody,
  CreateMeasurementResult,
  MeasureFactor,
  PreconBoqRowDto,
  PreconGeometryRow,
  UpdateGeometryBody,
} from "./types.ts";

export async function updateGeometryIn(
  ctx: EditorWriteContext,
  sessionId: string,
  rowId: string,
  body: UpdateGeometryBody,
  actor: string,
): Promise<PreconBoqRowDto> {
  const row = await requireRow(ctx, rowId);
  const target = await resolveEditTarget(ctx, rowId, body.geometryId);
  // Refuses rather than guesses: a tool it cannot establish would silently
  // re-bill the line at its bare base figure. A legacy line supplies it through
  // body.confirm, which the QS states against the saved basis.
  const { tool, factor } = resolveMeasureTool(target?.definition ?? null, body.confirm);

  const sheet = await requireSheet(ctx, rowId, sessionId, body.sheetId);
  const resolved = resolveShape({ tool, shape: body.shape, vertices: body.vertices });
  const vertices = resolved.vertices;
  const pick = boundScale(sheet, target ?? null) ?? scaleForTool(sheet, tool, vertices);
  validateGeometry(tool, deriveShape(resolved.shape).logical, factor);
  const measured = measureShape(tool, resolved.shape, mmPerPtOf(pick), factor);

  // The shape carries the DRAWN figure; the row carries the billed one. Storing
  // gross here made the column mean two different things depending on which
  // writer last touched it, so nothing downstream could read it safely.
  const definition = measurementDefinitionOfShape(
    { tool, shape: resolved.shape, factor, ...(assemblySnapshotOf(target?.definition) ? { assembly: assemblySnapshotOf(target?.definition)! } : {}) },
    sheet,
    pick,
  );
  const geometryId = target?.id ?? generateId("pgeo");
  if (target) {
    await ctx.geometries.updateGeometryMeasurement(target.id, {
      vertices,
      quantity: measured.base,
      unit: measured.baseUnit,
      definition,
    });
  } else {
    await ctx.geometries.insertGeometries([
      {
        id: geometryId,
        row_id: rowId,
        sheet_id: sheet.id,
        kind: GEOMETRY_KIND_BY_TOOL[tool],
        vertices,
        source: "manual",
        quantity: measured.base,
        unit: measured.baseUnit,
        definition,
      },
    ]);
  }

  // Re-added from every shape still on the line, not from the one just edited:
  // a wall drafted as two runs keeps both, and its openings are applied once.
  const recomputed = await recomputeRow(ctx, row, sessionId);
  if (row.unit && recomputed.unit !== row.unit) {
    throw new BadRequestError(
      `This line is billed in ${row.unit}; measuring it as a ${tool.replace("_", " ")} would make it ${recomputed.unit}. Change the unit on the line first.`,
    );
  }
  const unit = row.unit ?? recomputed.unit;
  const typical = row.typical ?? 1;
  const shapes = recomputed.contributions.length;
  const head =
    shapes > 1
      ? `Manually re-measured (${tool.replace("_", " ")}); ${shapes} shapes${factorClause(tool, factor)}; gross ${recomputed.gross} ${unit}${scaleClause(sheet, pick)}`
      : `Manually re-measured (${tool.replace("_", " ")}); ${measured.base} ${measured.baseUnit}${factorClause(tool, factor)}; gross ${recomputed.gross} ${unit}${scaleClause(sheet, pick)}`;
  if (isAnchorRow(row)) assertDerivedFanout(derivedRowsIn(await ctx.rows.rowsBySession(sessionId)).length);

  const before = measuredStateOf(row, factorOf(target?.definition));
  const after = { ...measuredStateOf(row, factor), qty: recomputed.net, gross: recomputed.gross, unit };
  const updated = await ctx.rows.updateRowVersioned(rowId, body.version, {
    qty_gross: recomputed.gross,
    qty: recomputed.net,
    unit,
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
  if (!updated) throw new ConflictError("Row changed since you loaded it; refresh and redraw");

  await record(
    ctx,
    sessionId,
    rowId,
    actor,
    "measured",
    { qty: num(row.qty), geometryId },
    { qty: recomputed.net, gross: recomputed.gross, tool, geometryId },
    body.operationId,
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

/**
 * The shape this edit is about. An explicit id is checked against the line and
 * used as given, which is what lets the editor correct one run of a wall drafted
 * as several. Without one, a line with exactly one shape is unambiguous — and a
 * line with more than one is REFUSED rather than having its newest shape picked
 * and the rest quietly re-billed away (contract 5).
 */
async function resolveEditTarget(
  ctx: EditorWriteContext,
  rowId: string,
  geometryId: string | undefined,
): Promise<PreconGeometryRow | null> {
  const shapes = contributingShapes(await ctx.geometries.geometriesByRow(rowId));
  if (geometryId) {
    const chosen = shapes.find((shape) => shape.id === geometryId);
    if (!chosen) throw new NotFoundError("Measurement");
    return chosen;
  }
  if (shapes.length === 0) return null;
  if (shapes.length > 1) {
    throw new BadRequestError(
      `This line is measured by ${shapes.length} shapes; say which one you are redrawing rather than replacing them all.`,
    );
  }
  return shapes[0]!;
}

function factorOf(definition: unknown): MeasureFactor {
  return tryResolveMeasureTool(definition ?? null)?.factor ?? {};
}


export async function createMeasurementIn(
  ctx: EditorWriteContext,
  sessionId: string,
  body: CreateMeasurementBody,
  actor: string,
): Promise<CreateMeasurementResult> {
  const sheet = await ctx.sheets.sheetById(body.sheetId);
  if (!sheet || sheet.session_id !== sessionId) throw new NotFoundError("Sheet");
  if (!body.description.trim()) throw new BadRequestError("Give the line a description");
  const typical = normaliseTypical(body.typical);
  // The shape is what the command declares; the vertices the row stores are
  // derived from it. Both, disagreeing, is refused rather than resolved.
  const resolved = resolveShape({ tool: body.tool, shape: body.shape, vertices: body.vertices });
  const vertices = resolved.vertices;
  // The same check `updateGeometryIn` runs, and for the same reason. Creation
  // skipped it, so an outline the editor would refuse to SAVE could be brought
  // into being — a bow-tie whose two lobes net against each other in shoelace,
  // billing a figure nobody can defend and never raising an error.
  validateGeometry(body.tool, deriveShape(resolved.shape).logical, body.factor);
  // A count needs no scale, so it never reaches scaleAt's uncalibrated refusal.
  // An outline spanning two scale regions is refused unless the QS says which
  // scale the whole of it is taken at (contract 12) — picking the region the
  // first vertex happened to land in bills part of the shape at the wrong scale.
  const pick = pickScaleForNew(sheet, body.tool, vertices, body.scaleChoice);
  const q = measureShape(body.tool, resolved.shape, mmPerPtOf(pick), body.factor);
  const unit = body.unit?.trim() || q.unit;
  const sheetCode = sheet.code ?? sheet.title ?? sheet.file_name;
  const bill = await targetBill(ctx, sessionId, body.billId);
  const qty = netQuantity(q.gross, [], typical);
  const rate = body.rate ?? null;
  // A person drew it, so it lands verified by that person; the rate is theirs
  // too, not a rate card's.
  const row = await ctx.rows.insertBoqRow({
    id: generateId("pbr"),
    bill_id: bill.id,
    sort: await ctx.rows.nextRowSort(bill.id),
    row_type: "item",
    element_group: body.elementGroup,
    code: body.code ?? null,
    description: body.description.trim(),
    unit,
    qty_gross: q.gross,
    deductions: [],
    typical,
    qty,
    rate,
    amount: rate === null ? null : Math.round(qty * rate * 100) / 100,
    rate_source: rate === null ? null : "manual",
    confidence: "high",
    status: "verified",
    version: 1,
    measurement_basis: manualBasis(body.tool, q, `on ${sheetCode}${scaleClause(sheet, pick)}`, body.factor, typical, unit),
    confidence_reason: null,
    provenance: `Measured by hand on ${sheetCode} by ${actor}`,
    origin: "manual",
    edited_at: null,
    edited_by: null,
    verified_by: actor,
    verified_at: new Date(),
  });

  // Without a definition a redraw has only vertices, so a 7 m run billed as
  // 18.9 m2 of wall comes back bare. Built from THIS request's validated inputs.
  const geometry: Omit<PreconGeometryRow, "created_at"> = {
    id: generateId("pgeo"),
    row_id: row.id,
    sheet_id: sheet.id,
    kind: q.geometryKind,
    vertices,
    source: "manual",
    quantity: q.base,
    unit: q.baseUnit,
    definition: measurementDefinitionOfShape(
      { tool: body.tool, shape: resolved.shape, factor: body.factor ?? {} },
      sheet,
      pick,
    ),
  };
  await ctx.geometries.insertGeometries([geometry]);
  await record(ctx, sessionId, row.id, actor, "measured_by_hand", null, {
    tool: body.tool,
    sheetId: sheet.id,
    qty: Number(row.qty),
    unit,
    typical,
    basis: row.measurement_basis,
  });
  ctx.emit({
    type: "row.created",
    sessionId,
    rowId: row.id,
    version: row.version,
    actor,
    changes: {
      billId: row.bill_id,
      description: row.description,
      qty: Number(row.qty),
      rate: row.rate === null ? null : Number(row.rate),
      tool: body.tool,
      sheetId: sheet.id,
    },
  });
  return { row: toRow(row), geometry: toGeometry({ ...geometry, created_at: new Date() }) };
}
