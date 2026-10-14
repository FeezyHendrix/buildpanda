import type { Culpability } from "./site-records";
import type { PhaseStatus } from "./common";

export type BimVersionStatus = "Processing" | "Ready" | "Failed";

export interface BimModel {
  id: string;
  projectId: string;
  name: string;
  discipline: string | null;
  currentVersionId: string | null;
  status: BimVersionStatus | null;
  elementCount: number | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BimIssueStatus = "Open" | "Closed";

export interface BimCoordinationIssue {
  id: string;
  bimModelId: string;
  elementGuid: string | null;
  position: unknown;
  title: string;
  description: string | null;
  status: BimIssueStatus;
  rfiId: string | null;
  assigneeId: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BimUploadTicket =
  | { mode: "single"; storagePath: string; url: string }
  | {
      mode: "multipart";
      storagePath: string;
      uploadId: string;
      partSize: number;
      parts: { partNumber: number; url: string }[];
    };

export type ApprovalStatus = "Pending" | "Approved" | "Rejected" | "Resubmit";

export interface Approval {
  id: string;
  projectId: string;
  title: string;
  category: string | null;
  description: string | null;
  status: ApprovalStatus;
  response: string | null;
  responseHtml: string | null;
  dueDate: string | null;
  submittedById: string | null;
  requestedReviewerId: string | null;
  requestedReviewerName: string | null;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalComment {
  id: string;
  approvalId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface ApprovalDetail extends Approval {
  comments: ApprovalComment[];
}

export type SelectionStatus = "open" | "decided" | "cancelled";

export interface SelectionOption {
  id: string;
  selectionId: string;
  name: string;
  description: string | null;
  price: number | null;
  sortOrder: number;
}

export interface Selection {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  category: string | null;
  allowanceAmount: number | null;
  currency: string;
  dueDate: string | null;
  status: SelectionStatus;
  chosenOptionId: string | null;
  decidedById: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  changeRequestId: string | null;
  createdById: string | null;
  /** Chosen option price minus allowance when both are present (min 0). */
  overage: number | null;
  options: SelectionOption[];
  createdAt: string;
  updatedAt: string;
}

export type ChangeStatus = "Draft" | "Submitted" | "Approved" | "Executed" | "Rejected";

/**
 * What kind of change this is. A variation adds work, an omission removes it,
 * an EOT-only claim asks for time and no money, and a provisional-sum
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

/**
 * One delay a time claim is argued from. A contractor-culpable delay is never
 * claimable, so the server refuses a claim citing one and names it.
 */
export interface ChangeDelay {
  id: string;
  activityId: string;
  activityName: string;
  reasonCode: string;
  daysLost: number;
  culpability: Culpability | string;
  eotClaimable: boolean;
  startedAt: string;
}

export interface ChangeRequest {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  reason: string | null;
  reasonHtml: string | null;
  status: ChangeStatus;
  costImpact: number;
  timeImpactDays: number;
  currency: "NGN" | "USD";
  submittedById: string | null;
  decidedById: string | null;
  decidedByName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  decidedAt: string | null;
  commentCount: number;
  /** Contract created when the change order was executed; null until then. */
  contractId?: string | null;
  type: ChangeType;
  /** The build stage the change moves; its end date shifts on Execute. */
  stageId: string | null;
  /** The RFI this change came out of, when it did. */
  rfiId: string | null;
  /**
   * Days actually granted on a time claim; null until it is decided. An award
   * is usually fewer days than were claimed, and the gap is the negotiation.
   */
  daysAwarded: number | null;
  /** The delay events a time claim is argued from. */
  delays: ChangeDelay[];
  rejectedReason: string | null;
  submittedAt: string | null;
  revisions: ChangeRevision[];
  createdAt: string;
  updatedAt: string;
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

export type PermitStatus = "NotStarted" | "Applied" | "Approved" | "Rejected" | "Expired";

export type PermitUrgency = "expired" | "expiringSoon" | "active" | "none";

export interface Permit {
  id: string;
  projectId: string;
  title: string;
  authority: string | null;
  referenceNo: string | null;
  status: PermitStatus;
  appliedDate: string | null;
  approvedDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  documentId: string | null;
  conditions: string | null;
  responsiblePerson: string | null;
  renewalSubmittedAt: string | null;
  leadTimeDays: number | null;
  urgency: PermitUrgency;
  daysUntilExpiry: number | null;
  createdAt: string;
  updatedAt: string;
}

export type KeyDateStatus = "Upcoming" | "Met" | "Missed";

export interface KeyDate {
  id: string;
  projectId: string;
  label: string;
  targetDate: string | null;
  actualDate: string | null;
  status: KeyDateStatus;
  notes: string | null;
  /** The activity that delivers this date; the cascade moves it when that activity slips. */
  linkedActivityId: string | null;
  /** A contract date with LD consequences — only an approved EOT moves it. */
  isContractual: boolean;
  /** Server-stamped once, with the originally programmed target, the first time the date moves. */
  revisedFrom: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInsights {
  progress: { stagesTotal: number; stagesComplete: number; overallPercent: number };
  openItems: { awaitingApproval: number };
  budget: { currency: string; total: number; released: number; remaining: number; approvedChangeCost: number };
  scheduleRisk: { approvedChangeDays: number; permitsAtRisk: number; missedKeyDates: number };
}

export type StageStatus = PhaseStatus;
