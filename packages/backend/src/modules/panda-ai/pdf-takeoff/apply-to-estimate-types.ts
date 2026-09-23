// The take-off → estimate contract: the diff, the drift tokens that pin it,
// and the acknowledgement an unverified quantity requires.
//
// Preview and apply are separate requests against data two people can be
// editing at once. Between them a row can be re-measured, a line deleted, a
// rate typed on the estimate, or the revision sent. Applying the preview the
// user actually read therefore has to prove that neither side moved: the
// preview hands back a fingerprint of the take-off it measured and a
// fingerprint of the estimate it diffed against, and apply must present both.
//
// Apply never infers them. A request that omits the tokens is refused rather
// than treated as "apply whatever is current now" — that is precisely the
// silent overwrite this contract exists to prevent.

import type { EstimateStatus } from "../../proposals/types.ts";
import type { RowStatus } from "./row-types.ts";

export const APPLY_MODES = ["preview", "apply"] as const;
export type ApplyMode = (typeof APPLY_MODES)[number];

export type ApplyChange = "added" | "changed" | "removed" | "unchanged";

export interface ExpectedRow {
  id: string;
  version: number;
}

export interface ApplyPreviewItem {
  groupLabel: string;
  description: string;
  descriptionHtml?: string | null;
  qty: number;
  unit: string;
  unitRate: number;
  boqItemId: string | null;
  takeoffSessionId: string | null;
  change: ApplyChange;
  previous?: { qty: number; unit: string; description: string };
  /** The take-off line's review state, absent for items this session did not produce. */
  reviewStatus?: RowStatus | null;
  rowVersion?: number | null;
}

/**
 * What the take-off looked like when the preview was computed: the exact rows
 * consumed with the versions they were at, plus one fingerprint covering the
 * whole active source set — its rows, its bills and its summary settings — so
 * a row ADDED elsewhere in the session invalidates the preview too, not only a
 * change to a row the preview happened to use.
 */
export interface ApplySourceState {
  sessionId: string;
  fingerprint: string;
  expectedRows: ExpectedRow[];
  rowCount: number;
}

/**
 * What the estimate looked like. The fingerprint covers its complete editable
 * state — status, contingency, tax and every field of every item the
 * replacement would overwrite. Deliberately NOT `updatedAt`: recalcTotals does
 * not touch it, so a timestamp would miss a totals change entirely.
 */
export interface ApplyTargetState {
  estimateId: string;
  fingerprint: string;
  status: EstimateStatus;
  itemCount: number;
}

export interface ApplyReviewState {
  verified: number;
  needsReview: number;
  aiGenerated: number;
  /** The exact lines an apply must acknowledge by id before unverified quantities are written. */
  unverifiedRowIds: string[];
}

/** The diff on its own: what apply would do, with nothing said about drift. */
export interface ApplyDiff {
  added: number;
  changed: number;
  removed: number;
  unchanged: number;
  items: ApplyPreviewItem[];
}

export interface ApplyPreview extends ApplyDiff {
  source: ApplySourceState;
  target: ApplyTargetState;
  review: ApplyReviewState;
}

export interface ApplyResult extends ApplyPreview {
  applied: true;
  written: number;
}

export interface ApplyToEstimateBody {
  estimateId: string;
  mode: ApplyMode;
  /** Required when mode is "apply"; ignored for a preview. */
  sourceFingerprint?: string;
  targetFingerprint?: string;
  expectedRows?: ExpectedRow[];
  acknowledgedUnverifiedRowIds?: string[];
}

/** Everything that moved, so the client can say what changed rather than just "conflict". */
export interface ApplyDriftDetails {
  reasons: string[];
  source: ApplySourceState;
  target: ApplyTargetState;
  review: ApplyReviewState;
}
