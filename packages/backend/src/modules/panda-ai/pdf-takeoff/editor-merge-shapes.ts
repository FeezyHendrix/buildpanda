// Where a merge puts the drawings, which is two different acts wearing one name.
//
// UNION is a re-measurement. It applies when every line carries exactly one
// closed outline: two slabs that overlap must be billed once, not twice, so the
// polygons are unioned and the result — which may be one outline, one outline
// with a courtyard in it, or several that do not touch — replaces them. The
// original outlines are superseded, because the figure now comes from a shape
// nobody drew by hand.
//
// ABSORB is a re-assignment. It applies to everything else compatible: runs,
// counts, and lines already measured by several drawings. Nothing is
// re-measured and nothing is re-traced — each drawing MOVES onto the surviving
// line under the id it already had, keeping its arcs, its scale binding and the
// openings cut out of it, and the line is re-added from all of them. That is
// what stops a merge inventing an edge across a gap: two runs 7 m apart stay
// two runs.
//
// Choosing between them on the outlines rather than on the line count is what
// lets a wall traced as three runs merge at all.

import { generateId } from "../../../lib/ids.ts";
import { asRing, unionShapes } from "./editor-batch-rules.ts";
import { overlapArea } from "./measurement-topology.ts";
import { shapeWrite, replaceShapes } from "./editor-batch-shapes.ts";
import type { MergeLine } from "./editor-batch-restate.ts";
import type { BatchWriteContext } from "./editor-unit-of-work.ts";
import { deductionDefinition } from "./measurement-definition.ts";
import { measureVertices } from "./measurements.ts";
import type { VertexRing } from "./measurement-topology.ts";
import { mmPerPtOf, scaleAt } from "./viewports.ts";
import type { Deduction, PreconGeometryRow, PreconSheetRow } from "./types.ts";

export interface MergePlacement {
  createdGeometryIds: string[];
  /** Shapes this merge took out of the reckoning; the receipt restores exactly these. */
  supersededGeometryIds: string[];
  /** The voids a union enclosed, as openings against the outline each sits in. */
  holeDeductions: Deduction[];
  outlines: number;
}

export interface MergeRequest {
  lines: MergeLine[];
  keep: MergeLine;
  sheet: PreconSheetRow;
}

/**
 * True when every drawing on every line is a closed outline the union can
 * measure — whatever the COUNT of them.
 *
 * It used to demand exactly one per line, which let a slab that had been split
 * in two take the absorb path and bill the strip it shares with an overlapping
 * neighbour twice. How many drawings carry an area has nothing to do with
 * whether two areas overlap, so it cannot be what decides between summing and
 * unioning.
 */
export const isUnionable = (lines: MergeLine[]): boolean =>
  lines.every((line) => line.shapes.every((shape) => shape.kind === "area"));

/**
 * The outline a surviving opening is now a hole in.
 *
 * An opening was cut out of a parent the union has just replaced, so it has to
 * be re-anchored or it points at a withdrawn drawing. The new anchor is the
 * outline that actually contains it — never simply the first, which on a merge
 * that produced several disjoint outlines would move a void to a slab it was
 * never cut out of. A STATED opening has no outline of its own to place, so it
 * takes the first: it records a size, not a position.
 */
function anchorFor(cut: PreconGeometryRow, outlines: { id: string; ring: VertexRing }[]): string {
  const first = outlines[0]!;
  if (!Array.isArray(cut.vertices) || cut.vertices.length < 3) return first.id;
  const ring = asRing(cut.vertices);
  let best = first;
  let bestArea = 0;
  for (const outline of outlines) {
    const area = overlapArea(outline.ring, ring);
    if (area > bestArea) {
      bestArea = area;
      best = outline;
    }
  }
  return best.id;
}

/**
 * Re-anchor the openings and bring them onto the surviving line, keeping the
 * records themselves. Soft-deleting them instead would leave the figure on the
 * row while destroying what it was taken off — the mode, the typed dimensions
 * and any way to correct it.
 */
async function carryCutouts(
  ctx: BatchWriteContext,
  cuts: PreconGeometryRow[],
  rowId: string,
  outlines: { id: string; ring: VertexRing }[],
): Promise<void> {
  for (const cut of cuts) {
    const anchor = anchorFor(cut, outlines);
    if (cut.row_id !== rowId) await ctx.geometries.moveGeometryToRow(cut.id, rowId);
    await ctx.geometries.reparentGeometry(cut.id, anchor);
    const stored = cut.definition;
    if (typeof stored === "object" && stored !== null && !Array.isArray(stored)) {
      await ctx.geometries.updateGeometryMeasurement(cut.id, {
        definition: { ...(stored as Record<string, unknown>), parentGeometryId: anchor },
      });
    }
  }
}

/** The outlines the union replaced. Their openings have already been re-anchored. */
async function supersede(
  ctx: BatchWriteContext,
  geometries: PreconGeometryRow[],
  staleIds: string[],
  deletedAt: Date,
): Promise<string[]> {
  const gone = new Set(staleIds);
  const superseded: string[] = [];
  for (const shape of geometries) {
    if (!gone.has(shape.id) || shape.deleted_at) continue;
    await ctx.geometries.softDeleteGeometry(shape.id, deletedAt);
    superseded.push(shape.id);
  }
  return superseded;
}

async function unionOnto(
  ctx: BatchWriteContext,
  request: MergeRequest,
  byRow: Map<string, PreconGeometryRow[]>,
): Promise<MergePlacement> {
  const { lines, keep, sheet } = request;
  const original = keep.shapes[0]!;
  const parents = lines.flatMap((line) => line.shapes);
  const shapes = unionShapes(parents.map((shape) => asRing(shape.vertices)));
  const pick = scaleAt(sheet, shapes[0]!.outer);
  const written = shapes.map((shape) => shapeWrite(keep.tool, shape.outer, keep.factor, sheet, pick, original, null));
  const placed = await replaceShapes(ctx, original, keep.rowId, sheet.id, written);
  const parentIds = [placed.keptId, ...placed.createdIds];

  // The openings move BEFORE their old parents are withdrawn:
  // `parent_geometry_id` is RESTRICT, and an opening still naming a superseded
  // outline is a void taken off a drawing the bill no longer has.
  const outlines = parentIds.map((id, index) => ({ id, ring: shapes[index]!.outer }));
  const cuts = lines
    .flatMap((line) => byRow.get(line.rowId) ?? [])
    .filter((shape) => shape.kind === "deduction" && !shape.deleted_at);
  await carryCutouts(ctx, cuts, keep.rowId, outlines);

  const deletedAt = new Date();
  // Every outline the union replaced — the absorbed lines' as well as this
  // line's own spares. The first is reused in place, so it is not among them.
  const stale = parents.filter((shape) => shape.id !== original.id).map((shape) => shape.id);
  const superseded = await supersede(ctx, parents, stale, deletedAt);

  const createdGeometryIds = [...placed.createdIds];
  const holeDeductions: Deduction[] = [];
  for (const [index, shape] of shapes.entries()) {
    for (const hole of shape.holes) {
      holeDeductions.push(
        await cutHole(ctx, {
          hole,
          parentId: parentIds[index]!,
          rowId: keep.rowId,
          sheetId: sheet.id,
          mmPerPt: mmPerPtOf(pick),
          ordinal: holeDeductions.length + 1,
          createdGeometryIds,
        }),
      );
    }
  }
  return { createdGeometryIds, supersededGeometryIds: superseded, holeDeductions, outlines: shapes.length };
}

interface HoleRequest {
  hole: VertexRing;
  parentId: string;
  rowId: string;
  sheetId: string;
  mmPerPt: number;
  ordinal: number;
  createdGeometryIds: string[];
}

async function cutHole(ctx: BatchWriteContext, request: HoleRequest): Promise<Deduction> {
  const measured = measureVertices("area", request.hole, request.mmPerPt, {});
  const holeId = generateId("pgeo");
  request.createdGeometryIds.push(holeId);
  await ctx.geometries.insertGeometries([
    {
      id: holeId,
      row_id: request.rowId,
      sheet_id: request.sheetId,
      kind: "deduction",
      vertices: request.hole,
      source: "manual",
      quantity: measured.gross,
      unit: measured.unit,
      parent_geometry_id: request.parentId,
      definition: deductionDefinition(request.parentId, "area", request.hole),
    },
  ]);
  return {
    label: `Enclosed void ${request.ordinal}`,
    qty: measured.gross,
    geometryId: holeId,
    unit: measured.unit,
    unitConfirmed: true,
  };
}

/**
 * Every drawing of every absorbed line, moved onto the survivor — openings
 * included, so each keeps pointing at the outline it was cut out of and stays
 * editable as the opening it is.
 */
async function absorbOnto(
  ctx: BatchWriteContext,
  request: MergeRequest,
  byRow: Map<string, PreconGeometryRow[]>,
): Promise<MergePlacement> {
  for (const line of request.lines.slice(1)) {
    for (const shape of byRow.get(line.rowId) ?? []) {
      if (shape.deleted_at) continue;
      await ctx.geometries.moveGeometryToRow(shape.id, request.keep.rowId);
    }
  }
  const outlines = request.lines.reduce((total, line) => total + line.shapes.length, 0);
  return { createdGeometryIds: [], supersededGeometryIds: [], holeDeductions: [], outlines };
}

export function placeMergedShapes(
  ctx: BatchWriteContext,
  request: MergeRequest,
  byRow: Map<string, PreconGeometryRow[]>,
): Promise<MergePlacement> {
  return isUnionable(request.lines) ? unionOnto(ctx, request, byRow) : absorbOnto(ctx, request, byRow);
}
