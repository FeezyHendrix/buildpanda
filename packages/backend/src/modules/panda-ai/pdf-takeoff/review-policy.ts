// The one question that decides whether an edited bill line must be
// re-reviewed: did the edit actually move the measured quantity?
//
// A verified line is a contractual record — a figure a named person signed off
// at a named version. Changing the quantity, the unit it is billed in, the
// number of typical repeats behind it or the factor that turned a drawn shape
// into that figure makes the old sign-off a statement about a figure that no
// longer exists. That is true whoever authored the line: the engine, a QS by
// hand, or an assembly. Origin is not a licence to skip review.
//
// Wording and rate are the exceptions. A rate moves the amount, never the
// measured quantity or its basis, and a description is not a measurement at
// all — so the verification they carry still means exactly what it said.
//
// The comparison is on VALUES, not on which fields the request mentioned. An
// earlier version asked only "was `qty` present in the payload?", which made a
// save that re-sent the identical figure strip a valid sign-off and bump the
// version — the plan's "no-op saves do not increment versions or dirty
// verification". A client that PUTs the whole row every time, as the editor
// does, would have dirtied review on every keystroke-driven save.

import { num } from "./dto.ts";
import type { Deduction, MeasureFactor, PreconBoqRowRow } from "./types.ts";

/** Everything about a line that a re-verification would be a statement about. */
export interface MeasuredState {
  qty: number | null;
  gross: number | null;
  unit: string | null;
  typical: number;
  heightM: number | null;
  depthM: number | null;
  deductions: Deduction[];
}

/**
 * Quantities are compared at the precision the bill is kept to. Every stored
 * figure is already rounded to 2dp, so anything under half a minor unit is
 * float noise from re-deriving the same measurement, not an edit. This is the
 * same tolerance the derived-row recompute uses.
 */
const QUANTITY_EPSILON = 0.005;

export function sameQuantity(before: number | null, after: number | null): boolean {
  if (before === null || after === null) return before === after;
  return Math.abs(before - after) < QUANTITY_EPSILON;
}

function sameDeductions(before: Deduction[], after: Deduction[]): boolean {
  if (before.length !== after.length) return false;
  return before.every((entry, index) => {
    const other = after[index];
    return (
      other !== undefined &&
      entry.geometryId === other.geometryId &&
      entry.label === other.label &&
      entry.unit === other.unit &&
      sameQuantity(entry.qty, other.qty)
    );
  });
}

export function measuredStateOf(row: PreconBoqRowRow, factor: MeasureFactor = {}): MeasuredState {
  return {
    qty: num(row.qty),
    gross: num(row.qty_gross),
    unit: row.unit,
    typical: row.typical ?? 1,
    heightM: factor.heightM ?? null,
    depthM: factor.depthM ?? null,
    deductions: row.deductions ?? [],
  };
}

/** True when the two states describe the same billed figure on the same basis. */
export function sameMeasurement(before: MeasuredState, after: MeasuredState): boolean {
  return (
    sameQuantity(before.qty, after.qty) &&
    sameQuantity(before.gross, after.gross) &&
    before.unit === after.unit &&
    before.typical === after.typical &&
    sameQuantity(before.heightM, after.heightM) &&
    sameQuantity(before.depthM, after.depthM) &&
    sameDeductions(before.deductions, after.deductions)
  );
}

export function isQuantityChanging(before: MeasuredState, after: MeasuredState): boolean {
  return !sameMeasurement(before, after);
}

export function reviewResetPatch(): { status: "needs_review"; verified_by: null; verified_at: null } {
  return { status: "needs_review", verified_by: null, verified_at: null };
}

/**
 * The review half of a row patch, for a write that already knows both sides.
 * Empty when the figure did not move, so a re-save of the same measurement
 * keeps its sign-off. A line already awaiting review still has any stale
 * verifier stamp cleared, because that name would otherwise read as approval of
 * the new figure.
 */
export function reviewPatchFor(
  row: PreconBoqRowRow,
  before: MeasuredState,
  after: MeasuredState,
): Partial<{ status: "needs_review"; verified_by: null; verified_at: null }> {
  if (!isQuantityChanging(before, after)) return {};
  if (row.status === "verified") return reviewResetPatch();
  if (row.status === "needs_review") return { verified_by: null, verified_at: null };
  return {};
}
