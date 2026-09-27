// Re-measuring the openings on a line when the drawing under them moves.
//
// A cutout records no scale of its own. It is defined as a hole in a particular
// shape, so the ONLY correct scale for it is whatever that shape was measured
// at — not the sheet's, and not the region its own outline happens to sit in.
// The difference is not academic: a line can be measured by one slab on bare
// sheet and another inside a 1:20 detail, and re-scaling the sheet must move the
// first opening and leave the second exactly where it is.
//
// The four rules, each a wrong bill if it is missed:
//
//   * a drawn area cutout scales with mm-per-point SQUARED, like its slab;
//   * a drawn run scales linearly;
//   * a drawn volume cutout scales as an area and keeps its parent's STATED
//     depth — re-measuring it without that depth subtracts m² from m³;
//   * a stated opening (a 0.9 × 2.1 m door) is a real-world size and never
//     moves. Scaling it is how a door becomes 3.6 m wide.
//
// Nothing here guesses. An opening whose parent records no basis, or which no
// longer measures in the unit it is billed in, is reported unresolved and left
// untouched — and an unresolved opening blocks the whole re-scale, because a
// half-restated line is a bill nobody can reconcile.

import { boundScale } from "./editor-scale-binding.ts";
import { measureDeduction } from "./measurement-resolve.ts";
import { tryResolveMeasureTool } from "./measurement-resolve.ts";
import { mmPerPtOf, scaleForTool } from "./viewports.ts";
import { DEDUCTION_MODES, type Deduction, type DeductionMode, type PreconBoqRowRow, type PreconGeometryRow, type PreconSheetRow } from "./types.ts";

export interface CutFigure {
  geometryId: string;
  qty: number;
  unit: string;
}

export interface RecutOutcome {
  /** The row's openings with the re-measured ones replaced; labels and order kept. */
  deductions: Deduction[];
  /** Only the openings that actually moved, for writing back their own figures. */
  cuts: CutFigure[];
  unresolved: boolean;
}

export interface RecutRequest {
  row: PreconBoqRowRow;
  /** Every live shape on the line — parents and openings alike. */
  shapes: PreconGeometryRow[];
  /** The drawing a shape sits on, already substituted for the proposed version. */
  sheetFor: (sheetId: string) => PromiseLike<PreconSheetRow | null>;
}

/** A stated opening carries its size in its definition, not in points. */
const isDrawn = (shape: PreconGeometryRow): boolean =>
  Array.isArray(shape.vertices) && shape.vertices.length >= 2;

/** The mode an opening's own definition records, when it records a readable one. */
function storedMode(definition: unknown): DeductionMode | undefined {
  if (typeof definition !== "object" || definition === null) return undefined;
  const { mode } = definition as { mode?: unknown };
  return (DEDUCTION_MODES as readonly unknown[]).includes(mode) ? (mode as DeductionMode) : undefined;
}

export async function recutDeductions({ row, shapes, sheetFor }: RecutRequest): Promise<RecutOutcome> {
  const billed = row.deductions ?? [];
  if (billed.length === 0) return { deductions: [], cuts: [], unresolved: false };

  const byId = new Map(shapes.map((shape) => [shape.id, shape]));
  const cuts: CutFigure[] = [];
  let unresolved = false;

  for (const shape of shapes) {
    if (shape.kind !== "deduction" || shape.deleted_at) continue;
    const entry = billed.find((deduction) => deduction.geometryId === shape.id);
    if (!entry || !isDrawn(shape)) continue;

    const parentId = shape.parent_geometry_id ?? null;
    const parent = parentId === null ? undefined : byId.get(parentId);
    if (!parent || parent.deleted_at) continue;
    const parentSheet = await sheetFor(parent.sheet_id);
    if (!parentSheet) continue;

    const resolved = tryResolveMeasureTool(parent.definition ?? null);
    if (!resolved) {
      unresolved = true;
      continue;
    }
    const pick = boundScale(parentSheet, parent) ?? scaleForTool(parentSheet, resolved.tool, parent.vertices);
    let cut: { qty: number; unit: string };
    try {
      // The mode this opening RECORDS, so a legacy record whose dimension
      // disagrees with its line stops the re-scale instead of being re-measured
      // into a figure that still disagrees.
      cut = measureDeduction(row.unit, shape.vertices, mmPerPtOf(pick), resolved.factor, storedMode(shape.definition));
    } catch {
      // A cutout that can no longer be measured in the unit its line is billed
      // in is exactly the case that must stop the write, not be skipped.
      unresolved = true;
      continue;
    }
    if (entry.unit !== null && entry.unit !== undefined && cut.unit !== entry.unit) {
      unresolved = true;
      continue;
    }
    cuts.push({ geometryId: shape.id, qty: cut.qty, unit: cut.unit });
  }

  const moved = new Map(cuts.map((cut) => [cut.geometryId, cut]));
  const deductions = billed.map((deduction) => {
    const cut = deduction.geometryId === null ? undefined : moved.get(deduction.geometryId);
    return cut ? { ...deduction, qty: cut.qty, unit: cut.unit } : deduction;
  });
  return { deductions, cuts, unresolved };
}
