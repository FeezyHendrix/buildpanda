// The three commands that take an opening out of a measured line, plus the two
// that reach a legacy one.
//
// Split out of `editor-command-types.ts` at the house 400-line ceiling.
// `editor-command-types.ts` re-exports all of it, so an importer never has to
// know which half a name lives in.

import type { DeductionMode } from "./editor-types.ts";

/**
 * An opening taken out of a line. Either drawn (`vertices`) or stated
 * (`dimensions`) — a wall opening is a width × height off an elevation, and
 * reading it off a plan footprint measures the wrong thing entirely (contract 6).
 */
export interface AddDeductionCommand {
  kind: "add-deduction";
  rowId: string;
  label: string;
  mode?: DeductionMode;
  vertices?: number[][];
  dimensions?: { widthM?: number; heightM?: number; depthM?: number };
  sheetId?: string;
}

export interface EditDeductionCommand {
  kind: "edit-deduction";
  rowId: string;
  geometryId: string;
  /** Declared, and checked against the dimension the line is billed in — never substituted. */
  mode?: DeductionMode;
  vertices?: number[][];
  dimensions?: { widthM?: number; heightM?: number; depthM?: number };
}

export interface RemoveDeductionCommand {
  kind: "remove-deduction";
  rowId: string;
  geometryId: string;
}

/**
 * Exactly which legacy opening is meant, and exactly what it says right now.
 *
 * A stated opening the ENGINE drafted has no shape and therefore no geometry id
 * (`boq-draft.ts` writes `geometryId: null`), so the two commands above — which
 * find their target by that id — cannot reach it at all. The only handle left is
 * its position in the line's list, and a position is not an identity: inserting
 * or withdrawing another opening renumbers it, so an edit aimed at index 1 would
 * silently land on a different void.
 *
 * So the position is paired with a full statement of what is there. The row
 * version says "the line has not moved at all"; `expect` says "and entry 1 is
 * still the one I was shown". Both must hold, or the edit is refused rather than
 * applied to whatever is now in that slot. This is additive: no column changes
 * and no id is invented for a record that never had one.
 */
export interface StatedDeductionTarget {
  rowId: string;
  rowVersion: number;
  index: number;
  expect: { label: string; qty: number; unit: string | null };
}

/**
 * Re-entering a legacy opening as typed numbers.
 *
 * `unit` and `unitConfirmed: true` are REQUIRED because the records this reaches
 * are exactly the ones that carry `unitConfirmed: false` — a figure the engine
 * assumed nets off the line's unit and nobody checked. Letting an edit through
 * without stating it would keep an unchecked assumption while making the line
 * look freshly confirmed.
 */
export interface EditStatedDeductionCommand extends StatedDeductionTarget {
  kind: "edit-stated-deduction";
  label?: string;
  qty: number;
  unit: string;
  unitConfirmed: true;
}

export interface RemoveStatedDeductionCommand extends StatedDeductionTarget {
  kind: "remove-stated-deduction";
}

export type EditorDeductionCommand =
  | AddDeductionCommand
  | EditDeductionCommand
  | RemoveDeductionCommand
  | EditStatedDeductionCommand
  | RemoveStatedDeductionCommand;
