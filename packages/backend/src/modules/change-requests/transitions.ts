import { BadRequestError, ConflictError } from "../../lib/errors.ts";
import type {
  ChangeAction,
  ChangeRequestRow,
  ChangeRevision,
  ChangeStatus,
} from "./types.ts";

/**
 * How a change request moves, and who may move it.
 *
 * A variation is a contractual instrument: the contractor proposes it and the
 * engineer or employer decides it. Two rules follow and neither is negotiable:
 *
 *  • Status is never typed in. Editing the record must not be able to walk the
 *    approval ladder, which is how a rejected change was "resubmitted" through
 *    the edit dialog and how a draft could be approved without being submitted.
 *  • The person who raised it cannot decide it. Someone who genuinely holds the
 *    decision (change-requests:approve, i.e. `manage`) may, and that is a
 *    separate grant, not a side effect of being able to edit.
 *
 * Rejecting always carries a reason and resubmission opens a new version, so
 * "v1 ₦4.8m rejected → v2 ₦4.2m approved" is legible afterwards.
 */

const ALLOWED_FROM: Record<ChangeAction, readonly ChangeStatus[]> = {
  submit: ["Draft"],
  approve: ["Submitted"],
  reject: ["Submitted"],
  resubmit: ["Rejected"],
  execute: ["Approved"],
};

const RESULT: Record<ChangeAction, ChangeStatus> = {
  submit: "Submitted",
  approve: "Approved",
  reject: "Rejected",
  resubmit: "Submitted",
  execute: "Executed",
};

export function resultingStatus(action: ChangeAction): ChangeStatus {
  return RESULT[action];
}

const PAST_TENSE: Record<ChangeAction, string> = {
  submit: "submitted",
  approve: "approved",
  reject: "rejected",
  resubmit: "resubmitted",
  execute: "executed",
};

export function assertTransition(action: ChangeAction, from: ChangeStatus): void {
  if (!ALLOWED_FROM[action].includes(from)) {
    throw new ConflictError(
      `A ${from} change request cannot be ${PAST_TENSE[action]} — it must be ${ALLOWED_FROM[action].join(" or ")}`,
    );
  }
}

/** A rejection without a reason is not a decision anyone can answer. */
export function assertReason(action: ChangeAction, reason: string | undefined): string | null {
  const trimmed = reason?.trim();
  if (action === "reject" && !trimmed) {
    throw new BadRequestError("Say why the change is rejected — the contractor has to answer it");
  }
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

/**
 * Nobody decides their own change. Holding the approval grant is the exception:
 * on a small job the QS who raises the variation may also be the person the
 * employer authorised to certify it.
 */
export function assertNotSelfDecision(
  row: ChangeRequestRow,
  userId: string,
  holdsApproval: boolean,
): void {
  if (row.submitted_by_id === userId && !holdsApproval) {
    throw new ConflictError(
      "You raised this change — someone with the approval permission has to decide it",
    );
  }
}

export function parseRevisions(value: ChangeRevision[] | string | null | undefined): ChangeRevision[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as ChangeRevision[]) : [];
  } catch {
    return [];
  }
}

/** Appends the version being submitted now to the record's revision history. */
export function appendRevision(
  row: ChangeRequestRow,
  actor: { id: string; name: string },
  overrides: { costImpact?: number; timeImpactDays?: number; reason?: string | null } = {},
): ChangeRevision[] {
  const existing = parseRevisions(row.revisions);
  return [
    ...existing,
    {
      version: existing.length + 1,
      costImpact: overrides.costImpact ?? Number(row.cost_impact),
      timeImpactDays: overrides.timeImpactDays ?? row.time_impact_days,
      reason: overrides.reason ?? row.reason ?? null,
      status: "Submitted",
      actorId: actor.id,
      actorName: actor.name,
      at: new Date().toISOString(),
    },
  ];
}
