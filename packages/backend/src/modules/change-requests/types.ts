import type { CurrencyCode } from "../../lib/currencies.ts";

export const CHANGE_STATUSES = ["Draft", "Submitted", "Approved", "Executed", "Rejected"] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

/**
 * What kind of change this is. A variation adds work, an omission removes it,
 * an eot_only claim asks for time and no money, and a provisional_sum
 * adjustment converts a sum already in the contract into measured work.
 */
export const CHANGE_TYPES = ["variation", "omission", "eot_only", "provisional_sum"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

/** The actions that move a change request. Status is never set by hand. */
export const CHANGE_ACTIONS = ["submit", "approve", "reject", "resubmit", "execute"] as const;
export type ChangeAction = (typeof CHANGE_ACTIONS)[number];

/**
 * One submitted version of the change. "v1 ₦4.8m rejected → v2 ₦4.2m approved"
 * is the negotiation, and a list that silently shows ₦4.2m as if it had always
 * been that is not a record of it.
 */
export interface ChangeRevision {
  version: number;
  costImpact: number;
  timeImpactDays: number;
  reason: string | null;
  status: ChangeStatus;
  actorId: string | null;
  actorName: string;
  at: string;
}
export type Currency = CurrencyCode;

/**
 * One delay a time claim cites, with the attribution that decides whether it
 * buys time back. A contractor-culpable delay is never claimable, so a claim
 * that cites one is refused and names it.
 */
export interface ChangeDelay {
  id: string;
  activityId: string;
  activityName: string;
  reasonCode: string;
  daysLost: number;
  culpability: string;
  eotClaimable: boolean;
  startedAt: string;
}

/** A delay row joined to its activity, as a claim needs to see it. */
export interface ChangeDelayRow {
  id: string;
  change_request_id: string;
  activity_id: string;
  activity_name: string;
  reason_code: string;
  days_lost: number;
  culpability: string;
  eot_claimable: boolean;
  started_at: Date | string;
}

export interface ChangeRequest {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  descriptionHtml: string | null;
  reason: string | null;
  reasonHtml: string | null;
  status: ChangeStatus;
  type: ChangeType;
  costImpact: number;
  timeImpactDays: number;
  currency: Currency;
  /** The build stage the change moves; its end date shifts on Execute. */
  stageId: string | null;
  /** The RFI this change came out of, when it did. */
  rfiId: string | null;
  /**
   * Days actually granted on a time claim. Null until the claim is decided —
   * an award is usually fewer days than were claimed, and the difference
   * between `timeImpactDays` and this is the negotiation.
   */
  daysAwarded: number | null;
  /** The delay events a time claim is argued from. */
  delays: ChangeDelay[];
  rejectedReason: string | null;
  submittedAt: string | null;
  revisions: ChangeRevision[];
  submittedById: string | null;
  decidedById: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  estimateId: string | null;
  /** The change-order contract generated at approval; null until approved. */
  contractId: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Counts by status for the Change Orders tab header. */
export interface ChangeRequestSummary {
  draft: number;
  submitted: number;
  approved: number;
  executed: number;
  rejected: number;
  /**
   * Margin on the change orders. Null until change requests carry a cost
   * build-up (labour/material/markup) — the cost impact alone has no margin.
   */
  grossProfit: number | null;
}

export interface ChangeStatusCountRow {
  status: ChangeStatus;
  count: string;
}

export interface ChangeBudgetLink {
  budgetCategoryId: string;
  amount: number;
  committed: boolean;
}

export interface ChangeComment {
  id: string;
  changeRequestId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface ChangeRequestDetail extends ChangeRequest {
  comments: ChangeComment[];
}

export interface ChangeRequestRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  description_html: string | null;
  reason: string | null;
  reason_html: string | null;
  status: ChangeStatus;
  type: ChangeType;
  cost_impact: string;
  time_impact_days: number;
  currency: Currency;
  stage_id: string | null;
  rfi_id: string | null;
  days_awarded: number | null;
  /** How many days this claim has already moved the completion date by. */
  days_applied: number;
  rejected_reason: string | null;
  submitted_at: string | null;
  revisions: ChangeRevision[] | string | null;
  submitted_by_id: string | null;
  decided_by_id: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  estimate_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChangeCommentRow {
  id: string;
  change_request_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

export interface CreateChangeRequestInput {
  title: string;
  description?: string | null;
  descriptionHtml?: string | null;
  reason?: string | null;
  reasonHtml?: string | null;
  costImpact?: number;
  timeImpactDays?: number;
  currency?: Currency;
  assigneeId?: string | null;
  type?: ChangeType;
  stageId?: string | null;
  rfiId?: string | null;
  /** The delays a time claim is argued from; every one must be claimable. */
  delayIds?: string[];
}

/** Editing the content of a change. Status never appears here — actions move it. */
export interface UpdateChangeRequestInput {
  title?: string;
  description?: string | null;
  descriptionHtml?: string | null;
  reason?: string | null;
  reasonHtml?: string | null;
  costImpact?: number;
  timeImpactDays?: number;
  currency?: Currency;
  assigneeId?: string | null;
  type?: ChangeType;
  stageId?: string | null;
  rfiId?: string | null;
  delayIds?: string[];
}

/**
 * Rejecting and resubmitting both carry a reason; executing needs none.
 * Approving a time claim carries `daysAwarded` — the decision that actually
 * buys time, and usually fewer days than were claimed.
 */
export interface ChangeActionInput {
  reason?: string;
  costImpact?: number;
  timeImpactDays?: number;
  daysAwarded?: number;
}
