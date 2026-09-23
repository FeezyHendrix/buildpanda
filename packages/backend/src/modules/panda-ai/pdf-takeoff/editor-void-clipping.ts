// Keeping a line's voids attached when the outline they sit in is cut in two.
//
// A void belongs to a specific outline — `parent_geometry_id` names it, and
// `row.deductions[].geometryId` names the void. Split the outline and every one
// of those links points at a shape that is now only half of what it was. Left
// alone, the void either follows the wrong half (deducting from a piece it is
// not in) or is dropped with the shape it named, and the line silently starts
// billing the courtyard it was supposed to take off.
//
// So each void is intersected with each piece. A void wholly inside one piece
// moves to it, keeping its id. A void the cut passes through becomes one clipped
// void per piece — and because intersection partitions it, the parts sum to
// exactly what the original took off. Never dropped, never counted twice.

import { generateId } from "../../../lib/ids.ts";
import { deductionDefinition } from "./measurement-definition.ts";
import { polygonIntersectionStructured, type VertexRing } from "./measurement-topology.ts";
import { measureVertices } from "./measurements.ts";
import { mmPerPtOf } from "./viewports.ts";
import type { Deduction, PreconGeometryRow, ScalePick } from "./types.ts";

/** Below this a clipped fragment is a rounding artefact of the cut, not a void. */
const MIN_VOID_M2 = 1e-6;

const asRing = (vertices: number[][]): VertexRing => vertices.map((v) => [v[0]!, v[1]!]);

export interface VoidPiece {
  /** The void's id when it keeps one, or a fresh id for a clipped fragment. */
  geometryId: string;
  /** The void this fragment came from, so its label and unit still resolve. */
  sourceGeometryId: string;
  parentGeometryId: string;
  vertices: number[][];
  qty: number;
  unit: string;
  /** True when this is the original record being moved rather than a new one. */
  reuseId: boolean;
}

export interface ClipResult {
  pieces: VoidPiece[];
  /** Voids that fell entirely outside every piece; their records are withdrawn. */
  orphanedGeometryIds: string[];
}

export interface ClipInput {
  voids: PreconGeometryRow[];
  parentIds: string[];
  parentRings: number[][][];
  pick: ScalePick | null;
}

/**
 * Each void distributed across the pieces of the outline it belonged to.
 *
 * The first fragment of a void keeps the void's own id, so the row's deduction
 * entry and the audit trail both keep resolving; any further fragment is a new
 * record, because one void really has become two.
 */
export function clipVoidsToPieces({ voids, parentIds, parentRings, pick }: ClipInput): ClipResult {
  const mmPerPt = mmPerPtOf(pick);
  const pieces: VoidPiece[] = [];
  const orphanedGeometryIds: string[] = [];

  for (const hole of voids) {
    const ring = asRing(hole.vertices);
    let reused = false;
    let placed = 0;

    for (const [index, parent] of parentRings.entries()) {
      for (const overlap of polygonIntersectionStructured(ring, asRing(parent))) {
        const measured = measureVertices("area", overlap.outer, mmPerPt, {});
        if (measured.gross <= MIN_VOID_M2) continue;
        placed += 1;
        pieces.push({
          geometryId: reused ? generateId("pgeo") : hole.id,
          sourceGeometryId: hole.id,
          parentGeometryId: parentIds[index]!,
          vertices: overlap.outer,
          qty: measured.gross,
          unit: measured.unit,
          reuseId: !reused,
        });
        reused = true;
      }
    }
    if (placed === 0) orphanedGeometryIds.push(hole.id);
  }
  return { pieces, orphanedGeometryIds };
}

/**
 * The line's deduction list rebuilt around the clipped voids. Entries for voids
 * that were not touched by the split are carried through unchanged; a void that
 * became several keeps its label on each fragment so the bill still reads.
 */
export function deductionsAfterClip(
  existing: Deduction[],
  clipped: VoidPiece[],
  orphaned: string[],
  affected: Set<string>,
): Deduction[] {
  const untouched = existing.filter(
    (entry) => !entry.geometryId || (!affected.has(entry.geometryId) && !orphaned.includes(entry.geometryId)),
  );
  // Keyed on the void the fragment CAME FROM, so several clipped voids keep
  // their own labels rather than all inheriting the first one's.
  const labelBySource = new Map(existing.filter((e) => e.geometryId).map((e) => [e.geometryId!, e.label] as const));

  const fragments = clipped.map((piece) => ({
    label: labelBySource.get(piece.sourceGeometryId) ?? "Enclosed void",
    qty: piece.qty,
    geometryId: piece.geometryId,
    unit: piece.unit,
    unitConfirmed: true,
  }));
  return [...untouched, ...fragments];
}

export function deductionDefinitionFor(piece: VoidPiece): unknown {
  return deductionDefinition(piece.parentGeometryId, "area", piece.vertices);
}
