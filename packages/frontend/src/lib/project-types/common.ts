import type { CurrencyCode } from "../currency";


export type RiskLevel = "Low" | "Medium" | "High";
export type ProjectStatus = "On Track" | "At Risk" | "Delayed";
export type PhaseStatus = "Done" | "InProgress" | "Pending";
export type Currency = CurrencyCode;
export type Tone =
  | "brand"
  | "orange"
  | "green"
  | "purple"
  | "amber"
  | "red"
  | "gray";

export type UpdateCategory =
  | "Progress"
  | "Material Delivery"
  | "Inspections"
  | "Issues";
export type UpdateStatus =
  | "Open"
  | "Approved"
  | "Inspected"
  | "Resolved"
  | "Escalated";

// What Panda AI drafts for a project. The audience differs per value: `weekly`
// is the homeowner-facing client update, `daily` is the internal end-of-day
// digest written for the build team and never addressed to the client.
export const AI_UPDATE_CADENCES = ["off", "daily", "weekly", "both"] as const;
export type AiUpdateCadence = (typeof AI_UPDATE_CADENCES)[number];

// The non-null values of `ProjectUpdate.generatedKind`.
export const AI_DRAFT_KINDS = ["weekly", "daily"] as const;
export type AiDraftKind = (typeof AI_DRAFT_KINDS)[number];

export type MediaType = "photo" | "video";
export type DocumentStatus = "Verified" | "Pending" | "Expired";
export type InspectionStatus = "Action Required" | "Completed" | "Scheduled";
export type MilestoneStatus = "Completed" | "InProgress" | "Pending";
export type MilestoneClaimState = "pending" | "claimable" | "claimed" | "certified" | "paid";
export type SignOffStatus = "Verified" | "Scheduled" | "Pending";
export type LedgerType = "Release" | "Deposit" | "Hold";
export type DisputeStatus = "Open" | "Resolved" | "Withdrawn";
export type ActivityStatus =
  | "Planned"
  | "InProgress"
  | "Completed"
  | "Cancelled";
export type WeatherCondition =
  | "Sunny"
  | "Cloudy"
  | "Rain"
  | "Storm"
  | "Fog"
  | "ExtremeHeat";
// BuildPanda's seeded service catalogue. It is no longer the list the UI
// renders — that comes from `GET /projects/:id/inspection-categories`, which
// adds each workspace's own categories on top. Kept only as the seed names.
export const INSPECTION_CATEGORIES = [
  "Structural",
  "Quantity Survey",
  "General Progress",
  "Electrical",
  "Plumbing",
] as const;
export type InspectionCategory = "All Reports" | (typeof INSPECTION_CATEGORIES)[number];

export const INSPECTION_OUTCOMES = ["pass", "fail"] as const;
export type InspectionOutcome = (typeof INSPECTION_OUTCOMES)[number];

/**
 * Where the service order has got to. An inspection is a job BuildPanda is
 * asked to do, not a note the builder writes about its own work: the client
 * requests it, BuildPanda schedules it by assigning an inspector, the
 * inspector attends, and the report is issued.
 */
export const SERVICE_STATUSES = [
  "Requested",
  "Scheduled",
  "Attended",
  "Reported",
  "Cancelled",
] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

/** Which side of the contract asked for the inspection. Recorded, not claimed. */
export type RequesterSide = "client" | "contractor";
export type NotificationType =
  | "update_posted"
  | "update_action_required"
  | "inspection_scheduled"
  | "milestone_released"
  | "milestone_disputed"
  | "document_uploaded";

export interface ProjectPhase {
  id: string;
  name: string;
  status: PhaseStatus;
  dateRange: string;
}
