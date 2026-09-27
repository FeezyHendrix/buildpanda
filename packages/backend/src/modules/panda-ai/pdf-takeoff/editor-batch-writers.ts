// Reshaping ONE line's drawing: splitting a run at a vertex, cutting a segment
// out of it, cutting an area in two with a drawn line, and moving or rotating a
// shape.
//
// Each rewrites more than the row the caller is looking at, so each runs inside
// the editor's unit of work — one session lock, one transaction, one audit entry
// — and each refuses in full before it writes anything. The decisions live in
// `editor-batch-rules.ts`, the shape writing in `editor-batch-shapes.ts` and the
// shared restatement in `editor-batch-restate.ts`, so the answer is known before
// the first statement rather than discovered halfway through.

import { BadRequestError, ConflictError, NotFoundError } from "../../../lib/errors.ts";
import { num, toRow } from "./dto.ts";
import { splitPolygonByCut } from "./measurement-topology.ts";
import { clipVoidsToPieces, deductionDefinitionFor, deductionsAfterClip } from "./editor-void-clipping.ts";
import {
  asRing,
  removeSegmentFrom,
  splitVerticesAt,
} from "./editor-batch-rules.ts";
import {
  drawnOnly,
  measuredLine,
  requireSessionSheet,
  restateRow,
} from "./editor-batch-restate.ts";
import type { BatchWriteContext } from "./editor-unit-of-work.ts";
import { record, requireRow } from "./editor-writers.ts";
import {
  mapDefinitionShape,
  mapVertices,
  replaceShapes,
  rigidMotion,
  shapeWrite,
} from "./editor-batch-shapes.ts";
import { resolveMeasureTool } from "./measurement-resolve.ts";
import { measureVertices, netQuantity } from "./measurements.ts";
import { mmPerPtOf, scaleForTool } from "./viewports.ts";
import type {
  GeometryKind,
  PreconBoqRowDto,
  RemoveSegmentBody,
  RemoveSegmentResult,
  SplitPolygonBody,
  SplitPolygonResult,
  TransformGeometryBody,
  SplitPolylineBody,
  SplitPolylineResult,
} from "./types.ts";

/** Splitting and trimming act on a drawn run; a polygon or a tally has no sides to take off. */
const RUN_KINDS: readonly GeometryKind[] = ["linear"];

export async function splitPolylineIn(
  ctx: BatchWriteContext,
  sessionId: string,
  rowId: string,
  body: SplitPolylineBody,
  actor: string,
): Promise<SplitPolylineResult> {
  const row = await requireRow(ctx, rowId);
  const line = await measuredLine(ctx, sessionId, row, "splitting");
  if (!RUN_KINDS.includes(line.geometry.kind)) {
    throw new BadRequestError(`Only a drawn run can be split; this line is drawn as ${line.geometry.kind}`);
  }
  const { left, right } = splitVerticesAt(line.geometry.vertices, body.splitAtIndex);
  const leftPiece = measureVertices(line.tool, left, mmPerPtOf(line.pick), line.factor);
  const rightPiece = measureVertices(line.tool, right, mmPerPtOf(line.pick), line.factor);
  const head = `Split at vertex ${body.splitAtIndex} into ${leftPiece.base} + ${rightPiece.base} ${leftPiece.baseUnit}`;

  const updated = await restateRow(
    ctx,
    sessionId,
    { row, version: body.version, ...line, drawn: [...line.others, left, right], head, event: "geometry.updated" },
    actor,
  );
  const written = await replaceShapes(ctx, line.geometry, rowId, line.sheet.id, [
    shapeWrite(line.tool, left, line.factor, line.sheet, line.pick, line.geometry, null),
    shapeWrite(line.tool, right, line.factor, line.sheet, line.pick, line.geometry, null),
  ]);
  const pieces: [string, string] = [written.keptId, written.createdIds[0]!];
  const before = { qty: num(row.qty), vertices: line.geometry.vertices.length };
  const after = { qty: num(updated.qty), at: body.splitAtIndex, pieces };
  await record(ctx, sessionId, rowId, actor, "polyline_split", before, after, body.operationId);
  return { original: toRow(updated), pieces, createdGeometryIds: written.createdIds };
}

export async function removeSegmentIn(
  ctx: BatchWriteContext,
  sessionId: string,
  rowId: string,
  segmentIndex: number,
  body: RemoveSegmentBody,
  actor: string,
): Promise<RemoveSegmentResult> {
  const row = await requireRow(ctx, rowId);
  const line = await measuredLine(ctx, sessionId, row, "trimming");
  if (!RUN_KINDS.includes(line.geometry.kind)) {
    throw new BadRequestError(`Only a drawn run has segments to remove; this line is drawn as ${line.geometry.kind}`);
  }
  // An interior cut leaves TWO runs. Both stay on the line and the line is
  // re-added from both, which is the answer a QS expects: taking a length out of
  // the middle of a wall does not make the rest of it stop existing.
  const pieces = removeSegmentFrom(line.geometry.vertices, segmentIndex);
  const written = pieces.map((piece) => shapeWrite(line.tool, piece, line.factor, line.sheet, line.pick, line.geometry, null));
  const left = written.reduce((total, piece) => total + piece.quantity, 0);
  const head =
    pieces.length > 1
      ? `Segment ${segmentIndex} removed; ${pieces.length} runs left`
      : `Segment ${segmentIndex} removed; ${Math.round(left * 100) / 100} ${written[0]!.unit} left`;

  const updated = await restateRow(
    ctx,
    sessionId,
    { row, version: body.version, ...line, drawn: [...line.others, ...pieces], head, event: "geometry.updated" },
    actor,
  );
  const shapes = await replaceShapes(ctx, line.geometry, rowId, line.sheet.id, written);
  const before = { qty: num(row.qty), vertices: line.geometry.vertices.length };
  const after = { qty: num(updated.qty), segmentIndex, pieces: pieces.length };
  await record(ctx, sessionId, rowId, actor, "segment_removed", before, after, body.operationId);
  return { row: toRow(updated), createdGeometryIds: shapes.createdIds };
}

/**
 * Moving or rotating a drawing. It is the same measurement in a different place,
 * so the shape keeps its id and its definition is MAPPED rather than rebuilt —
 * rebuilding would straighten every arc on the way through.
 */
export async function transformGeometryIn(
  ctx: BatchWriteContext,
  sessionId: string,
  rowId: string,
  body: TransformGeometryBody,
  actor: string,
): Promise<PreconBoqRowDto> {
  const row = await requireRow(ctx, rowId);
  const geometry = await ctx.geometries.geometryById(body.geometryId);
  if (!geometry || geometry.row_id !== rowId || geometry.kind === "deduction") throw new NotFoundError("Measurement");
  const sheet = await requireSessionSheet(ctx, sessionId, geometry.sheet_id);
  const { tool, factor } = resolveMeasureTool(geometry.definition ?? null);
  const pick = scaleForTool(sheet, tool, geometry.vertices);

  const about = body.about ?? (geometry.vertices[0] ? [geometry.vertices[0][0]!, geometry.vertices[0][1]!] : [0, 0]);
  const move = rigidMotion(body.translate ?? [0, 0], body.rotateDeg ?? 0, about as [number, number]);
  const moved = mapVertices(geometry.vertices, move);
  const written = shapeWrite(tool, moved, factor, sheet, pick, geometry, mapDefinitionShape(geometry.definition, move));

  const others = drawnOnly(await ctx.geometries.geometriesByRow(rowId)).filter((g) => g.id !== geometry.id);
  const updated = await restateRow(
    ctx,
    sessionId,
    {
      row,
      version: body.version,
      tool,
      factor,
      drawn: [...others.map((g) => g.vertices), moved],
      sheet,
      pick,
      head: "Moved on the drawing",
      event: "geometry.updated",
    },
    actor,
  );
  await ctx.geometries.updateGeometryMeasurement(geometry.id, {
    vertices: written.vertices,
    quantity: written.quantity,
    unit: written.unit,
    definition: written.definition,
  });
  await record(
    ctx,
    sessionId,
    rowId,
    actor,
    "geometry_transformed",
    { qty: num(row.qty), geometryId: geometry.id },
    { qty: num(updated.qty), geometryId: geometry.id },
    body.operationId,
  );
  return toRow(updated);
}

/** A slab cut in two by a drawn line: both pieces stay on the line, which still measures the same. */
export async function splitPolygonIn(
  ctx: BatchWriteContext,
  sessionId: string,
  rowId: string,
  body: SplitPolygonBody,
  actor: string,
): Promise<SplitPolygonResult> {
  const row = await requireRow(ctx, rowId);
  const geometry = await ctx.geometries.geometryById(body.geometryId);
  if (!geometry || geometry.row_id !== rowId || geometry.kind === "deduction") throw new NotFoundError("Measurement");
  if (geometry.kind !== "area") throw new BadRequestError("Only an area can be split with a cut line");
  const sheet = await requireSessionSheet(ctx, sessionId, geometry.sheet_id);
  const { tool, factor } = resolveMeasureTool(geometry.definition ?? null);
  const pick = scaleForTool(sheet, tool, geometry.vertices);

  const pieces = splitPolygonByCut(asRing(geometry.vertices), body.cut[0], body.cut[1]);
  const written = pieces.map((piece) => shapeWrite(tool, piece.outer, factor, sheet, pick, geometry, null));
  const others = drawnOnly(await ctx.geometries.geometriesByRow(rowId)).filter((g) => g.id !== geometry.id);

  const updated = await restateRow(
    ctx,
    sessionId,
    {
      row,
      version: body.version,
      tool,
      factor,
      drawn: [...others.map((g) => g.vertices), ...written.map((w) => w.vertices)],
      sheet,
      pick,
      head: `Split into ${written.length} pieces by a cut line`,
      event: "geometry.updated",
    },
    actor,
  );
  const shapes = await replaceShapes(ctx, geometry, rowId, sheet.id, written);
  const parentIds = [shapes.keptId, ...shapes.createdIds];

  // The voids that belonged to the outline just cut have to follow the halves
  // they sit in, or the line starts billing the courtyard it deducted.
  const voids = (await ctx.geometries.geometriesByRow(rowId)).filter(
    (g) => g.kind === "deduction" && g.parent_geometry_id === geometry.id,
  );
  const createdGeometryIds = [...shapes.createdIds];
  let deductions = row.deductions ?? [];
  if (voids.length > 0) {
    const clip = clipVoidsToPieces({
      voids,
      parentIds,
      parentRings: written.map((w) => w.vertices),
      pick,
    });
    for (const piece of clip.pieces) {
      const definition = deductionDefinitionFor(piece);
      if (piece.reuseId) {
        await ctx.geometries.updateGeometryMeasurement(piece.geometryId, {
          vertices: piece.vertices,
          quantity: piece.qty,
          unit: piece.unit,
          definition,
        });
        await ctx.geometries.reparentGeometry(piece.geometryId, piece.parentGeometryId);
      } else {
        createdGeometryIds.push(piece.geometryId);
        await ctx.geometries.insertGeometries([
          {
            id: piece.geometryId,
            row_id: rowId,
            sheet_id: sheet.id,
            kind: "deduction",
            vertices: piece.vertices,
            source: "manual",
            quantity: piece.qty,
            unit: piece.unit,
            parent_geometry_id: piece.parentGeometryId,
            definition,
          },
        ]);
      }
    }
    const now = new Date();
    for (const orphan of clip.orphanedGeometryIds) await ctx.geometries.softDeleteGeometry(orphan, now);
    deductions = deductionsAfterClip(deductions, clip.pieces, clip.orphanedGeometryIds, new Set(voids.map((v) => v.id)));
    const grossNow = num(updated.qty_gross) ?? 0;
    const netNow = netQuantity(grossNow, deductions, updated.typical ?? 1);
    const rebilled = await ctx.rows.updateRowVersioned(updated.id, updated.version, {
      deductions,
      qty: netNow,
      amount: updated.rate !== null ? Math.round(netNow * Number(updated.rate) * 100) / 100 : null,
    });
    if (!rebilled) throw new ConflictError("Row changed while splitting; refresh and retry");
    await record(
      ctx,
      sessionId,
      rowId,
      actor,
      "polygon_split",
      { qty: num(row.qty), geometryId: geometry.id },
      { qty: num(rebilled.qty), pieces: written.length, voids: clip.pieces.length },
      body.operationId,
    );
    return { row: toRow(rebilled), createdGeometryIds };
  }

  await record(
    ctx,
    sessionId,
    rowId,
    actor,
    "polygon_split",
    { qty: num(row.qty), geometryId: geometry.id },
    { qty: num(updated.qty), pieces: written.length },
    body.operationId,
  );
  return { row: toRow(updated), createdGeometryIds };
}

