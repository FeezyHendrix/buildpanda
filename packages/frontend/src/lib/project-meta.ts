import type { BadgeTone } from "@/components/atoms/badge";
import type {
  ActivityStatus,
  DocumentStatus,
  InspectionStatus,
  ParticipantStatus,
  PaymentLedgerEntry,
  ProjectStatus,
  RiskLevel,
  UpdateCategory,
} from "@/lib/project-types";
import type { InvoiceStatus } from "@/hooks/use-invoices";
import type { ProposalStatus } from "@/api/proposals";

export const UPDATE_CATEGORY_TONE: Record<UpdateCategory, BadgeTone> = {
  Progress: "success",
  "Material Delivery": "neutral",
  Inspections: "info",
  Issues: "danger",
};

export const UPDATE_CATEGORY_LABEL: Record<UpdateCategory, string> = {
  Progress: "SITE PHOTO",
  "Material Delivery": "MATERIAL LOG",
  Inspections: "INSPECTION",
  Issues: "ISSUE",
};

export const DOCUMENT_STATUS_TONE: Record<DocumentStatus, BadgeTone> = {
  Verified: "success",
  Pending: "neutral",
  Expired: "danger",
};

export const INSPECTION_STATUS_TONE: Record<InspectionStatus, BadgeTone> = {
  "Action Required": "danger",
  Completed: "info",
  Scheduled: "warning",
};

export const RISK_LEVEL_TONE: Record<RiskLevel, BadgeTone> = {
  High: "danger",
  Medium: "warning",
  Low: "info",
};

export const PROJECT_STATUS_TONE: Record<ProjectStatus, BadgeTone> = {
  "On Track": "success",
  "At Risk": "warning",
  Delayed: "danger",
};

export const LEDGER_TYPE_TONE: Record<PaymentLedgerEntry["type"], BadgeTone> = {
  Release: "success",
  Deposit: "info",
  Hold: "warning",
};

export const PARTICIPANT_STATUS_TONE: Record<ParticipantStatus, BadgeTone> = {
  invited: "warning",
  active: "success",
  revoked: "neutral",
};

export const INVOICE_STATUS_TONE: Record<InvoiceStatus, BadgeTone> = {
  Draft: "neutral",
  Submitted: "info",
  Approved: "accent",
  Paid: "success",
};

export const ACTIVITY_STATUS_TONE: Record<ActivityStatus, BadgeTone> = {
  Planned: "neutral",
  InProgress: "info",
  Completed: "success",
  Cancelled: "danger",
};

export const ACTIVITY_STATUS_LABEL: Record<ActivityStatus, string> = {
  Planned: "Planned",
  InProgress: "In progress",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

export const PROPOSAL_STATUS_TONE: Record<ProposalStatus, BadgeTone> = {
  New: "info",
  Preparing: "accent",
  Sent: "warning",
  UnderReview: "warning",
  Revising: "accent",
  Accepted: "success",
  Converted: "success",
  Lost: "danger",
  Expired: "neutral",
};

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  New: "New",
  Preparing: "Preparing",
  Sent: "Sent",
  UnderReview: "Under Review",
  Revising: "Revising",
  Accepted: "Accepted",
  Converted: "Converted",
  Lost: "Lost",
  Expired: "Expired",
};
