import type { BadgeTone } from "@/components/atoms/badge";
import type {
  DocumentStatus,
  InspectionStatus,
  PaymentLedgerEntry,
  ProjectStatus,
  RiskLevel,
  UpdateCategory,
} from "@/lib/project-mock-data";

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
