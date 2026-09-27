// The restructures that span SEVERAL lines: merging areas into one, and moving a
// drawing from one line to another.
//
// Both can leave a line with nothing on it, and both have to keep the openings
// that were already taken off. Withdrawn lines are tombstoned, never erased.

import { BadRequestError, ConflictError, NotFoundError } from "../../../lib/errors.ts";
import { num, toRow } from "./dto.ts";
import { assertRowVersion, assertSheetVersion, mergeMismatch, reassignMismatch } from "./editor-batch-rules.ts";
import {
  drawnOnly,
  geometriesByRowId,
  mergeLine,
  requireSessionSheet,
  restateAcrossSheets,
  restateRow,
  sessionRows,
} from "./editor-batch-restate.ts";
import { placeMergedShapes } from "./editor-merge-shapes.ts";
import { assertOperationLimits } from "./editor-repository.ts";
import type { BatchWriteContext } from "./editor-unit-of-work.ts";
import { record } from "./editor-writers.ts";
import { type ResolvedTool, resolveMeasureTool } from "./measurement-resolve.ts";
import { scaleAt } from "./viewports.ts";
import type {
  Deduction,
  MergeGeometriesBody,
  MergeGeometriesResult,
  PreconBoqRowRow,
  ReassignGeometryBody,
  ReassignGeometryResult,
} from "./types.ts";

export async function mergeGeometriesIn(
  ctx: BatchWriteContext,
  sessionId: string,
  body: MergeGeometriesBody,
  actor: string,
): Promise<MergeGeometriesResult> {
  const rowIds = [...new Set(body.rowIds)];
  if (rowIds.length < 2) throw new BadRequestError("A merge needs at least two different lines");
  assertOperationLimits({ rowIds, geometryIds: [], sheetIds: [], markupIds: [] });

  const rows = await sessionRows(ctx, sessionId, rowIds);
  for (const row of rows) assertRowVersion(row, body.expectedRows ?? []);
  const byRow = geometriesByRowId(await ctx.geometries.geometriesByRows(rowIds));
  const lines = rows.map((row) => mergeLine(row, byRow.get(row.id) ?? []));
  const keep = lines[0]!;
  for (const other of lines.slice(1)) {
    const reason = mergeMismatch(keep, other);
    if (reason) throw new BadRequestError(`These lines cannot be merged: ${reason}`);
  }

  const sheet = await requireSessionSheet(ctx, sessionId, keep.sheetId);
  assertSheetVersion(sheet, body.expectedSheets ?? []);

  // Every absorbed line's openings come WITH it. Dropping them would bill a
  // void the QS already took off; copying them onto a line that already had
  // them would take it off twice. They are carried once, keyed by the shape
  // each was cut out of.
  const carried: Deduction[] = lines.flatMap((line) => line.row.deductions ?? []);
  const placed = await placeMergedShapes(ctx, { lines, keep, sheet }, byRow);

  // The absorbed lines are withdrawn, never erased: each was once a claim
  // against the bill, and its openings have to stay readable beside it. No
  // drawing goes down with the row: an absorb moved every one of them onto this
  // line, and a union moved the openings and superseded only the outlines it
  // actually replaced — both already done by `placeMergedShapes`.
  const deletedAt = new Date();
  const mergedRowIds: string[] = [];
  const absorbedGeometryIds = [...placed.supersededGeometryIds];
  for (const line of lines.slice(1)) {
    await ctx.rows.softDeleteRow(line.row.id, deletedAt);
    mergedRowIds.push(line.row.id);
    const version = line.row.version + 1;
    ctx.emit({ type: "row.deleted", sessionId, rowId: line.row.id, version, actor, changes: { mergedInto: keep.rowId } });
  }

  // Re-added AFTER the shapes have moved, and from the shapes themselves: each
  // is re-measured through its own recorded tool, factor and scale binding, so
  // an absorbed run measured against a viewport still bills at that viewport's
  // scale rather than at whatever the surviving line was drawn against.
  const deductions = [...carried, ...placed.holeDeductions];
  const head = placed.outlines > 1
    ? `Merged ${lines.length} lines into ${placed.outlines} separate drawings`
    : `Merged ${lines.length} lines into one drawing`;
  const updated = await restateAcrossSheets(
    ctx,
    sessionId,
    { row: { ...keep.row, deductions }, version: keep.row.version, head, event: "geometry.updated" },
    actor,
  );
  const withVoids = await ctx.rows.updateRowVersioned(updated.id, updated.version, { deductions });
  if (!withVoids) throw new ConflictError("Row changed while merging; refresh and retry");

  const before = { qty: num(keep.row.qty), rowIds };
  const after = { qty: num(withVoids.qty), mergedRowIds, outlines: placed.outlines, voids: placed.holeDeductions.length };
  await record(ctx, sessionId, keep.rowId, actor, "rows_merged", before, after, body.operationId);
  return { keptRow: toRow(withVoids), mergedRowIds, createdGeometryIds: placed.createdGeometryIds, absorbedGeometryIds };
}

export async function reassignGeometryIn(
  ctx: BatchWriteContext,
  sessionId: string,
  geometryId: string,
  body: ReassignGeometryBody,
  actor: string,
): Promise<ReassignGeometryResult> {
  const geometry = await ctx.geometries.geometryById(geometryId);
  if (!geometry || geometry.kind === "deduction") throw new NotFoundError("Geometry");
  if (geometry.row_id === body.targetRowId) throw new BadRequestError("That drawing is already billed on this line");

  const [source, target] = await sessionRows(ctx, sessionId, [geometry.row_id, body.targetRowId]);
  assertRowVersion(source!, body.expectedRows ?? []);
  assertRowVersion(target!, body.expectedRows ?? []);
  const sheet = await requireSessionSheet(ctx, sessionId, geometry.sheet_id);
  assertSheetVersion(sheet, body.expectedSheets ?? []);

  const moved = resolveMeasureTool(geometry.definition ?? null);
  const onTarget = await ctx.geometries.measurementGeometryForRow(target!.id);
  if (onTarget && onTarget.sheet_id !== geometry.sheet_id) {
    throw new BadRequestError("This drawing cannot move: the target line is measured on another sheet");
  }
  const destination = resolveMeasureTool(onTarget?.definition ?? null);
  const reason = reassignMismatch(
    { unit: source!.unit, tool: moved.tool, typical: source!.typical ?? 1 },
    { unit: target!.unit, tool: destination.tool, typical: target!.typical ?? 1 },
  );
  if (reason) throw new BadRequestError(`This drawing cannot move: ${reason}`);

  const [onSource, alsoOnTarget] = await Promise.all([
    ctx.geometries.geometriesByRow(source!.id),
    ctx.geometries.geometriesByRow(target!.id),
  ]);
  const pick = scaleAt(sheet, geometry.vertices);
  await ctx.geometries.moveGeometryToRow(geometryId, target!.id);

  const restate = (row: PreconBoqRowRow, at: ResolvedTool, drawn: number[][][], head: string) =>
    restateRow(
      ctx,
      sessionId,
      { row, version: row.version, tool: at.tool, factor: at.factor, drawn, sheet, pick, head, event: "geometry.updated" },
      actor,
    );
  const left = drawnOnly(onSource).filter((g) => g.id !== geometryId);

  // A line with nothing drawn on it any more is withdrawn, not left billing
  // zero. A zero-quantity row still prices, still exports and still reads as a
  // measured item; a tombstone reads as what it is, and the undo brings the line
  // and its drawing back together.
  if (left.length === 0) {
    const deletedAt = new Date();
    const emptied = await ctx.rows.updateRowVersioned(source!.id, source!.version, {
      qty_gross: null,
      qty: null,
      amount: null,
      measurement_basis: `Last drawing moved to "${target!.description}"`,
    });
    await ctx.rows.softDeleteRow(source!.id, deletedAt);
    const targetOnly = await restate(
      target!,
      destination,
      [...drawnOnly(alsoOnTarget).map((g) => g.vertices), geometry.vertices],
      `Drawing moved on from "${source!.description}"`,
    );
    ctx.emit({
      type: "row.deleted",
      sessionId,
      rowId: source!.id,
      version: (emptied ?? source!).version + 1,
      actor,
      changes: { emptiedInto: target!.id },
    });
    await record(
      ctx,
      sessionId,
      target!.id,
      actor,
      "geometry_reassigned",
      { geometryId, rowId: source!.id, qty: num(source!.qty) },
      { rowId: target!.id, qty: num(targetOnly.qty), sourceWithdrawn: true },
      body.operationId,
    );
    return { sourceRow: toRow(emptied ?? source!), targetRow: toRow(targetOnly), emptiedRowIds: [source!.id] };
  }

  const sourceRow = await restate(source!, moved, left.map((g) => g.vertices), "Drawing moved off this line");
  const gained = [...drawnOnly(alsoOnTarget).map((g) => g.vertices), geometry.vertices];
  const targetRow = await restate(target!, destination, gained, `Drawing moved on from "${source!.description}"`);
  const before = { geometryId, rowId: source!.id, qty: num(source!.qty) };
  const after = { rowId: target!.id, qty: num(targetRow.qty), sourceQty: num(sourceRow.qty) };
  await record(ctx, sessionId, target!.id, actor, "geometry_reassigned", before, after, body.operationId);
  return { sourceRow: toRow(sourceRow), targetRow: toRow(targetRow), emptiedRowIds: [] };
}
