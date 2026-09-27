// Copying a drawing onto a line of its own, including onto another drawing.
//
// A cross-sheet paste is the one case with two defensible answers that bill
// differently, so the caller states which: preserve the real size, or keep the
// drawn outline and re-measure it at the new scale.

import { BadRequestError, ConflictError } from "../../../lib/errors.ts";
import { generateId } from "../../../lib/ids.ts";
import { num, toRow } from "./dto.ts";
import {
  drawnOnly,
  measuredLine,
  requireSessionSheet,
  restateAcrossSheets,
  restateRow,
} from "./editor-batch-restate.ts";
import type { BatchWriteContext } from "./editor-unit-of-work.ts";
import { record, requireRow } from "./editor-writers.ts";
import {
  mapDefinitionShape,
  mapVertices,
  shapeWrite,
  type PointMap,
} from "./editor-batch-shapes.ts";
import { mmPerPtOf, scaleForTool } from "./viewports.ts";
import { measureVertices, netQuantity } from "./measurements.ts";
import { resolveMeasureTool } from "./measurement-resolve.ts";
import type {
  Deduction,
  DuplicateGeometryBody,
  DuplicateGeometryResult,
  DuplicateRowBody,
  DuplicateRowResult,
  MeasureFactor,
  MeasureTool,
  PreconGeometryRow,
  PreconSheetRow,
} from "./types.ts";

export async function duplicateGeometryIn(
  ctx: BatchWriteContext,
  sessionId: string,
  rowId: string,
  body: DuplicateGeometryBody,
  actor: string,
): Promise<DuplicateGeometryResult> {
  const row = await requireRow(ctx, rowId);
  if (row.version !== body.version) {
    throw new ConflictError(`Row was updated by someone else (current version ${row.version}); refresh and retry`);
  }
  const line = await measuredLine(ctx, sessionId, row, "duplicating");
  const [dx, dy] = body.offset ?? [0, 0];

  // A copy onto ANOTHER drawing has two defensible answers and they bill
  // differently, so the caller states which (contract 10). Preserve-real-size
  // rescales the outline so the copy measures the same thing it did; retrace
  // keeps the drawn outline and re-measures it at the new sheet's scale. Neither
  // may be guessed, so an unstated cross-sheet paste is refused above.
  const targetSheet = body.targetSheetId
    ? await requireSessionSheet(ctx, sessionId, body.targetSheetId)
    : line.sheet;
  const crossSheet = targetSheet.id !== line.sheet.id;
  if (crossSheet && !body.crossSheet) {
    throw new BadRequestError(
      "Copying onto another drawing changes what the outline measures. Say preserve-real-size to keep the real size, or retrace to keep the drawn outline.",
    );
  }
  const targetPick = scaleForTool(targetSheet, line.tool, [[0, 0]]);
  const sourceMm = mmPerPtOf(line.pick);
  const targetMm = mmPerPtOf(targetPick);
  const scale = crossSheet && body.crossSheet === "preserve-real-size" && targetMm > 0 ? sourceMm / targetMm : 1;
  const anchor = line.geometry.vertices[0] ?? [0, 0];
  const move: PointMap = ([x, y]) => [
    anchor[0]! + (x - anchor[0]!) * scale + dx,
    anchor[1]! + (y - anchor[1]!) * scale + dy,
  ];
  const copy = mapVertices(line.geometry.vertices, move);

  // The copy starts unreviewed on purpose: it is a new claim against the bill,
  // not a continuation of the one it was traced from.
  const created = await ctx.rows.insertBoqRow({
    id: generateId("pbr"),
    bill_id: row.bill_id,
    sort: await ctx.rows.nextRowSort(row.bill_id),
    row_type: row.row_type,
    element_group: row.element_group,
    code: row.code,
    description: `${row.description} (copy)`,
    unit: row.unit,
    qty_gross: 0,
    deductions: [],
    typical: row.typical ?? 1,
    qty: 0,
    rate: row.rate,
    amount: null,
    rate_source: row.rate_source,
    confidence: row.confidence,
    status: "needs_review",
    version: 1,
    measurement_basis: null,
    confidence_reason: null,
    provenance: `Copied from "${row.description}" by ${actor}`,
    origin: "manual",
    edited_at: new Date(),
    edited_by: actor,
    verified_by: null,
    verified_at: null,
  });

  const newGeometryId = generateId("pgeo");
  const written = shapeWrite(
    line.tool,
    copy,
    line.factor,
    targetSheet,
    targetPick,
    line.geometry,
    // a paste is a move, not a redraw, so the arc controls travel with it
    mapDefinitionShape(line.geometry.definition, move),
  );
  await ctx.geometries.insertGeometries([
    {
      id: newGeometryId,
      row_id: created.id,
      sheet_id: targetSheet.id,
      kind: line.geometry.kind,
      vertices: written.vertices,
      source: "manual",
      quantity: written.quantity,
      unit: written.unit,
      definition: written.definition,
    },
  ]);
  const head = crossSheet
    ? `Copied from "${row.description}" onto ${targetSheet.code ?? targetSheet.file_name} (${body.crossSheet})`
    : `Copied from "${row.description}"`;
  const updated = await restateRow(
    ctx,
    sessionId,
    { ...line, row: created, version: created.version, sheet: targetSheet, pick: targetPick, drawn: [copy], head, event: "row.created" },
    actor,
  );
  const after = { rowId: created.id, geometryId: newGeometryId, qty: num(updated.qty), crossSheet: body.crossSheet ?? null };
  await record(ctx, sessionId, created.id, actor, "row_duplicated", { rowId }, after, body.operationId);
  return { newRow: toRow(updated), newGeometryId };
}


/**
 * Copying a WHOLE line: every drawing it is measured by, and every void cut out
 * of those drawings.
 *
 * `duplicateGeometryIn` copies one shape, which is right for "duplicate this
 * bay" and wrong for "duplicate this wall" — a wall traced as three runs came
 * back as one, silently billing a third of itself. Here each contribution is
 * copied with its own scale binding and assembly snapshot, each void is copied
 * under a NEW id pointing at the COPY's outline, and the row's deduction list is
 * rewritten to name those new ids.
 */
export async function duplicateRowIn(
  ctx: BatchWriteContext,
  sessionId: string,
  rowId: string,
  body: DuplicateRowBody,
  actor: string,
): Promise<DuplicateRowResult> {
  const row = await requireRow(ctx, rowId);
  if (row.version !== body.version) {
    throw new ConflictError(`Row was updated by someone else (current version ${row.version}); refresh and retry`);
  }
  const all = await ctx.geometries.geometriesByRow(rowId);
  const parents = drawnOnly(all);
  if (parents.length === 0) throw new BadRequestError("Measure this line before duplicating it");

  // A line measured across two drawings is ordinary — a wall that turns the
  // corner onto the next sheet. So the destination and the scale conversion are
  // resolved PER SHAPE, from the sheet that shape was actually measured on.
  // Using the first shape's sheet for all of them silently re-billed the rest.
  const chosen = body.targetSheetId ? await requireSessionSheet(ctx, sessionId, body.targetSheetId) : null;
  const sheetsById = new Map<string, PreconSheetRow>();
  for (const shape of parents) {
    if (!sheetsById.has(shape.sheet_id)) {
      sheetsById.set(shape.sheet_id, await requireSessionSheet(ctx, sessionId, shape.sheet_id));
    }
  }
  const crossSheet = parents.some((shape: PreconGeometryRow) => (chosen ?? sheetsById.get(shape.sheet_id)!).id !== shape.sheet_id);
  if (crossSheet && !body.crossSheet) {
    throw new BadRequestError(
      "Copying onto another drawing changes what the outline measures. Say preserve-real-size to keep the real size, or retrace to keep the drawn outline.",
    );
  }

  const [dx, dy] = body.offset ?? [0, 0];
  const destinationOf = (shape: PreconGeometryRow): PreconSheetRow => chosen ?? sheetsById.get(shape.sheet_id)!;
  /** This shape's own conversion, about its own first vertex. */
  const moveFor = (shape: PreconGeometryRow): PointMap => {
    const from = sheetsById.get(shape.sheet_id)!;
    const to = destinationOf(shape);
    const anchor = shape.vertices[0] ?? [0, 0];
    const sourcePick = scaleForTool(from, "area", shape.vertices);
    const targetPick = scaleForTool(to, "area", [[0, 0]]);
    const scale =
      to.id !== from.id && body.crossSheet === "preserve-real-size" && mmPerPtOf(targetPick) > 0
        ? mmPerPtOf(sourcePick) / mmPerPtOf(targetPick)
        : 1;
    return ([x, y]) => [anchor[0]! + (x - anchor[0]!) * scale + dx, anchor[1]! + (y - anchor[1]!) * scale + dy];
  };
  const targetSheet = chosen ?? sheetsById.get(parents[0]!.sheet_id)!;
  const targetPick = scaleForTool(targetSheet, "area", [[0, 0]]);

  const created = await ctx.rows.insertBoqRow({
    id: generateId("pbr"),
    bill_id: row.bill_id,
    sort: await ctx.rows.nextRowSort(row.bill_id),
    row_type: row.row_type,
    element_group: row.element_group,
    code: row.code,
    description: `${row.description} (copy)`,
    unit: row.unit,
    qty_gross: 0,
    deductions: [],
    typical: row.typical ?? 1,
    qty: 0,
    rate: row.rate,
    amount: null,
    rate_source: row.rate_source,
    confidence: row.confidence,
    status: "needs_review",
    version: 1,
    measurement_basis: null,
    confidence_reason: null,
    provenance: `Copied from "${row.description}" by ${actor}`,
    origin: "manual",
    edited_at: new Date(),
    edited_by: actor,
    verified_by: null,
    verified_at: null,
  });

  // Each contribution keeps its own tool and factor: a line may be measured by
  // runs at different heights, and the copy has to bill what the original did.
  const createdGeometryIds: string[] = [];
  const parentIdBySource = new Map<string, string>();
  const drawn: number[][][] = [];
  let tool: MeasureTool = "area";
  let factor: MeasureFactor = {};
  const moveBySource = new Map<string, PointMap>();
  const destinationBySource = new Map<string, PreconSheetRow>();
  for (const shape of parents) {
    const resolved = resolveMeasureTool(shape.definition ?? null);
    tool = resolved.tool;
    factor = resolved.factor;
    const destination = destinationOf(shape);
    const move = moveFor(shape);
    moveBySource.set(shape.id, move);
    destinationBySource.set(shape.id, destination);
    const pick = scaleForTool(destination, resolved.tool, [[0, 0]]);
    const moved = mapVertices(shape.vertices, move);
    const written = shapeWrite(resolved.tool, moved, resolved.factor, destination, pick, shape, mapDefinitionShape(shape.definition, move));
    const id = generateId("pgeo");
    parentIdBySource.set(shape.id, id);
    createdGeometryIds.push(id);
    drawn.push(moved);
    await ctx.geometries.insertGeometries([
      {
        id,
        row_id: created.id,
        sheet_id: destination.id,
        kind: shape.kind,
        vertices: written.vertices,
        source: "manual",
        quantity: written.quantity,
        unit: written.unit,
        definition: written.definition,
      },
    ]);
  }

  const head = crossSheet
    ? `Copied from "${row.description}" onto ${targetSheet.code ?? targetSheet.file_name} (${body.crossSheet})`
    : `Copied from "${row.description}"`;
  // Each shape may sit on its own drawing at its own scale, so the figure comes
  // from the row recompute rather than from one sheet's pick.
  const spansSheets = new Set(parents.map((shape: PreconGeometryRow) => destinationOf(shape).id)).size > 1;
  const updated = spansSheets
    ? await restateAcrossSheets(ctx, sessionId, { row: created, version: created.version, head, event: "row.created" }, actor)
    : await restateRow(
        ctx,
        sessionId,
        { row: created, version: created.version, tool, factor, drawn, sheet: targetSheet, pick: targetPick, head, event: "row.created" },
        actor,
      );

  // The voids follow their own outline, under new ids so the original's records
  // keep pointing at the original.
  const voids = all.filter((shape: PreconGeometryRow) => shape.kind === "deduction");
  const deductions: Deduction[] = [];
  for (const hole of voids) {
    const parentId = hole.parent_geometry_id ? parentIdBySource.get(hole.parent_geometry_id) : undefined;
    if (!parentId) continue;
    const id = generateId("pgeo");
    createdGeometryIds.push(id);
    const sourceParentId = hole.parent_geometry_id!;
    const move = moveBySource.get(sourceParentId) ?? ((p: number[]) => [p[0]!, p[1]!]);
    const destination = destinationBySource.get(sourceParentId) ?? targetSheet;
    const holePick = scaleForTool(destination, "area", [[0, 0]]);
    const moved = mapVertices(hole.vertices, move);
    const measured = hole.vertices.length >= 3
      ? measureVertices("area", moved, mmPerPtOf(holePick), {}).gross
      : Number(hole.quantity ?? 0);
    await ctx.geometries.insertGeometries([
      {
        id,
        row_id: created.id,
        sheet_id: destination.id,
        kind: "deduction",
        vertices: moved,
        source: "manual",
        quantity: measured,
        unit: hole.unit,
        parent_geometry_id: parentId,
        definition: mapDefinitionShape(hole.definition, move) ?? hole.definition,
      },
    ]);
    const source = (row.deductions ?? []).find((entry) => entry.geometryId === hole.id);
    deductions.push({
      label: source?.label ?? "Opening",
      qty: measured,
      geometryId: id,
      unit: hole.unit,
      unitConfirmed: source?.unitConfirmed ?? true,
    });
  }

  let finalRow = updated;
  if (deductions.length > 0) {
    const grossNow = num(updated.qty_gross) ?? 0;
    const netNow = netQuantity(grossNow, deductions, updated.typical ?? 1);
    const rebilled = await ctx.rows.updateRowVersioned(updated.id, updated.version, {
      deductions,
      qty: netNow,
      amount: updated.rate !== null ? Math.round(netNow * Number(updated.rate) * 100) / 100 : null,
    });
    if (!rebilled) throw new ConflictError("Row changed while copying; refresh and retry");
    finalRow = rebilled;
  }

  await record(
    ctx,
    sessionId,
    created.id,
    actor,
    "row_duplicated",
    { rowId },
    { rowId: created.id, shapes: parents.length, voids: deductions.length, qty: num(finalRow.qty) },
    body.operationId,
  );
  return { newRow: toRow(finalRow), newRowId: created.id, createdGeometryIds };
}
