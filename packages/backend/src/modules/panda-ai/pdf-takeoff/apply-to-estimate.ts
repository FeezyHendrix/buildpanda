import { BadRequestError, ConflictError } from "../../../lib/errors.ts";
import type { CreateEstimateItemInput, Estimate, EstimateItem } from "../../proposals/types.ts";
import { reviewState, sameIdSet, sourceState, targetState } from "./apply-to-estimate-fingerprint.ts";
import type {
  ApplyDiff,
  ApplyPreview,
  ApplyPreviewItem,
  ApplyToEstimateBody,
  PreconBill,
  PreconBoqRowDto,
  PreconSummarySettings,
} from "./types.ts";

// Estimate items reference the take-off line that produced them (boqItemId =
// precon_boq_rows.id). Quantity flows through that link; the rate belongs to
// the estimate, so a re-apply keeps a rate the estimator already entered.

const PRICED_ROW_TYPES = new Set(["item", "provisional_sum"]);

type Candidate = Omit<ApplyPreviewItem, "change" | "previous">;

/** The take-off lines an apply would consume: priced, and not rejected. */
export function candidateRows(rows: PreconBoqRowDto[]): PreconBoqRowDto[] {
  return rows.filter((r) => PRICED_ROW_TYPES.has(r.rowType) && r.status !== "rejected");
}

function candidateItems(sessionId: string, bills: PreconBill[], rows: PreconBoqRowDto[]): Candidate[] {
  const billTitle = new Map(bills.map((b) => [b.id, b.title]));
  return candidateRows(rows).map((r) => ({
    groupLabel: r.elementGroup ?? billTitle.get(r.billId) ?? "General",
    description: r.description,
    qty: r.qty ?? 0,
    unit: r.unit ?? "item",
    unitRate: r.rate ?? 0,
    boqItemId: r.id,
    takeoffSessionId: sessionId,
    reviewStatus: r.status,
    rowVersion: r.version,
  }));
}

/**
 * Diff the take-off against the estimate's current items. Items linked to this
 * session are replaced by the take-off's lines (added / changed / removed);
 * hand-entered items and items linked to other take-offs are kept as they are.
 */
export function diffTakeoffAgainstEstimate(
  sessionId: string,
  bills: PreconBill[],
  rows: PreconBoqRowDto[],
  existing: EstimateItem[],
): ApplyDiff {
  const candidates = candidateItems(sessionId, bills, rows);
  const existingByLine = new Map(existing.filter((i) => i.boqItemId).map((i) => [i.boqItemId as string, i]));
  const items: ApplyPreviewItem[] = [];

  for (const candidate of candidates) {
    const previous = candidate.boqItemId ? existingByLine.get(candidate.boqItemId) : undefined;
    if (!previous) {
      items.push({ ...candidate, change: "added" });
      continue;
    }
    const unitRate = candidate.unitRate > 0 ? candidate.unitRate : previous.unitRate;
    const same =
      previous.qty === candidate.qty && previous.unit === candidate.unit && previous.description === candidate.description;
    items.push({
      ...candidate,
      unitRate,
      groupLabel: previous.groupLabel || candidate.groupLabel,
      change: same ? "unchanged" : "changed",
      previous: same ? undefined : { qty: previous.qty, unit: previous.unit, description: previous.description },
    });
  }

  const candidateLineIds = new Set(candidates.map((c) => c.boqItemId));
  for (const item of existing) {
    const fromThisSession = item.takeoffSessionId === sessionId || (item.boqItemId && rows.some((r) => r.id === item.boqItemId));
    if (fromThisSession && item.boqItemId && !candidateLineIds.has(item.boqItemId)) {
      items.push({
        groupLabel: item.groupLabel,
        description: item.description,
        qty: item.qty,
        unit: item.unit,
        unitRate: item.unitRate,
        boqItemId: item.boqItemId,
        takeoffSessionId: item.takeoffSessionId,
        change: "removed",
      });
    } else if (!fromThisSession) {
      items.push({
        groupLabel: item.groupLabel,
        description: item.description,
        descriptionHtml: item.descriptionHtml,
        qty: item.qty,
        unit: item.unit,
        unitRate: item.unitRate,
        boqItemId: item.boqItemId,
        takeoffSessionId: item.takeoffSessionId,
        change: "unchanged",
      });
    }
  }

  const count = (change: ApplyPreviewItem["change"]) => items.filter((i) => i.change === change).length;
  return { added: count("added"), changed: count("changed"), removed: count("removed"), unchanged: count("unchanged"), items };
}

/** The item list to write: everything in the preview except removed lines, re-sorted. */
export function itemsToWrite(preview: ApplyDiff): CreateEstimateItemInput[] {
  return preview.items
    .filter((i) => i.change !== "removed")
    .map(
      (
        { change: _change, previous: _previous, reviewStatus: _status, rowVersion: _version, ...item },
        index,
      ) => ({ ...item, sort: index }),
    );
}

export interface ApplyPreviewInput {
  sessionId: string;
  bills: PreconBill[];
  rows: PreconBoqRowDto[];
  settings: PreconSummarySettings;
  estimate: Estimate;
  existing: EstimateItem[];
}

/** The diff, plus the state of both sides that an apply will have to match. */
export function buildApplyPreview(input: ApplyPreviewInput): ApplyPreview {
  const { sessionId, bills, rows, settings, estimate, existing } = input;
  const diff = diffTakeoffAgainstEstimate(sessionId, bills, rows, existing);
  const consumed = candidateRows(rows);
  return {
    ...diff,
    source: sourceState(sessionId, bills, rows, settings, consumed),
    target: targetState(estimate, existing),
    review: reviewState(consumed),
  };
}

/**
 * Refuse an apply whose preview no longer describes reality.
 *
 * Every check runs against state read under both locks, so a pass here means
 * the write that follows lands on exactly what was previewed. Each reason is
 * collected rather than thrown on first sight: a client that drifted on two
 * counts should be told both, and the refreshed state travels with the error
 * so the UI can re-preview without a second round trip.
 */
export function assertNoDrift(current: ApplyPreview, body: ApplyToEstimateBody): void {
  const reasons: string[] = [];

  if (body.sourceFingerprint !== current.source.fingerprint) {
    reasons.push("The take-off has changed since this preview was made.");
  }
  if (body.targetFingerprint !== current.target.fingerprint) {
    reasons.push("The estimate has changed since this preview was made.");
  }

  const expected = new Map((body.expectedRows ?? []).map((r) => [r.id, r.version]));
  const live = new Map(current.source.expectedRows.map((r) => [r.id, r.version]));
  if (expected.size !== live.size || [...live].some(([id, version]) => expected.get(id) !== version)) {
    reasons.push("Take-off lines were added, removed or re-measured since this preview was made.");
  }

  if (!sameIdSet(body.acknowledgedUnverifiedRowIds ?? [], current.review.unverifiedRowIds)) {
    reasons.push(
      current.review.unverifiedRowIds.length === 0
        ? "These lines no longer need an unverified-quantity acknowledgement."
        : "Unverified lines must be acknowledged exactly as listed before they can be applied.",
    );
  }

  if (reasons.length > 0) {
    throw new ConflictError("This preview is out of date; review the changes and apply again.", {
      reasons,
      source: current.source,
      target: current.target,
      review: current.review,
    });
  }
}

/** Apply must be pinned to a preview; an unpinned request is never treated as "apply what is current". */
export function assertPinned(body: ApplyToEstimateBody): void {
  const missing = [
    body.sourceFingerprint ? null : "sourceFingerprint",
    body.targetFingerprint ? null : "targetFingerprint",
    body.expectedRows ? null : "expectedRows",
    body.acknowledgedUnverifiedRowIds ? null : "acknowledgedUnverifiedRowIds",
  ].filter((name): name is string => name !== null);
  if (missing.length > 0) {
    throw new BadRequestError(
      `Preview the changes before applying them. This request is missing ${missing.join(", ")}.`,
      { missing },
    );
  }
}
