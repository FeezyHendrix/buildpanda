import type { RiskLevel, Tone } from "../projects/types.ts";
import type { MediaItem, MediaType, Person } from "../updates/types.ts";

export type InspectionStatus = "Action Required" | "Completed" | "Scheduled";

// Categories are owned by their own workstream (they are becoming a
// database-driven, admin-managed list); this union stays as it was.
export const INSPECTION_CATEGORIES = [
  "Structural",
  "Quantity Survey",
  "General Progress",
  "Electrical",
  "Plumbing",
] as const;
export type InspectionCategory = (typeof INSPECTION_CATEGORIES)[number];

export const INSPECTION_OUTCOMES = ["pass", "fail"] as const;
export type InspectionOutcome = (typeof INSPECTION_OUTCOMES)[number];

/**
 * Where the service order has got to. An inspection is a job BuildPanda is
 * asked to do, not a note the builder writes about itself: it is requested,
 * scheduled once an inspector is assigned, attended, then reported.
 */
export const SERVICE_STATUSES = [
  "Requested",
  "Scheduled",
  "Attended",
  "Reported",
  "Cancelled",
] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

/** Which side of the contract asked for the inspection. */
export const REQUESTER_SIDES = ["client", "contractor"] as const;
export type RequesterSide = (typeof REQUESTER_SIDES)[number];

export interface InspectionReport {
  id: string;
  projectId: string;
  inspector: Person;
  /** The BuildPanda inspector's user id — null until one is assigned. */
  inspectorUserId: string | null;
  title: string;
  category: string;
  description: string;
  descriptionHtml: string | null;
  status: InspectionStatus;
  serviceStatus: ServiceStatus;
  riskLevel: RiskLevel;
  scheduledAt: string;
  activityId: string | null;
  location: string | null;
  holdPoint: boolean;
  outcome: InspectionOutcome | null;
  findings: string | null;
  reinspectionDate: string | null;
  inspectedAt: string | null;
  inspectedByName: string | null;
  requestedById: string | null;
  requestedBySide: RequesterSide;
  /** The party being inspected. The contractor is the subject, never the author. */
  contractorName: string | null;
  reportIssuedAt: string | null;
  /** Recorded, never charged — money is logged, not transacted. */
  feeAmount: number | null;
  feeCurrency: string | null;
  media: MediaItem[];
  reportUrl?: string;
}

export interface InspectionRow {
  id: string;
  project_id: string;
  inspector_id: string;
  inspector_name: string;
  inspector_role: string;
  inspector_initials_tone: Tone;
  inspector_avatar_url: string | null;
  inspector_user_id: string | null;
  title: string;
  category: string;
  category_id: string | null;
  cancellation_reason: string | null;
  description: string;
  description_html: string | null;
  status: InspectionStatus;
  service_status: ServiceStatus;
  risk_level: RiskLevel;
  scheduled_at: string;
  activity_id: string | null;
  location: string | null;
  hold_point: boolean;
  outcome: InspectionOutcome | null;
  findings: string | null;
  reinspection_date: Date | string | null;
  inspected_at: Date | string | null;
  inspected_by_id: string | null;
  inspected_by_name: string | null;
  requested_by_id: string | null;
  requested_by_side: RequesterSide;
  contractor_name: string | null;
  report_issued_at: Date | string | null;
  fee_amount: string | number | null;
  fee_currency: string | null;
  report_url: string | null;
  created_at: Date | string;
}

/** Recording a Pass or a Fail. A fail carries findings and a re-inspection date. */
export interface RecordOutcomeInput {
  outcome: InspectionOutcome;
  findings?: string | null;
  reinspectionDate?: string | null;
  media?: { type: MediaType; url: string }[];
}

export interface InspectionMediaRow {
  id: string;
  inspection_id: string;
  type: MediaType;
  url: string;
  sort_order: number;
}

/**
 * Who is acting. `isPlatformAdmin` is BuildPanda staff (the ADMIN_EMAILS
 * allowlist promoted to the global admin role) — never a self-declared
 * accountType, and never an org role.
 */
export interface InspectionActor {
  id: string;
  name: string | null;
  isPlatformAdmin: boolean;
}

export interface RequestInspectionInput {
  title: string;
  /** The catalogue row picked, when the caller has one. */
  categoryId?: string;
  category: string;
  description: string;
  descriptionHtml?: string | null;
  scheduledAt: string;
  activityId?: string | null;
  location?: string | null;
  holdPoint?: boolean;
  /** Overrides the project's contractor entity when a third party is being inspected. */
  contractorName?: string | null;
  feeAmount?: number | null;
  feeCurrency?: string | null;
}

export interface EditInspectionInput {
  title?: string;
  category?: string;
  categoryId?: string;
  description?: string;
  descriptionHtml?: string | null;
  scheduledAt?: string;
  status?: InspectionStatus;
  riskLevel?: RiskLevel;
  activityId?: string | null;
  location?: string | null;
  holdPoint?: boolean;
  contractorName?: string | null;
  feeAmount?: number | null;
  feeCurrency?: string | null;
}

/** The BuildPanda staff account being put on a job. */
export interface InspectorUser {
  id: string;
  name: string | null;
  email: string;
}

/** BuildPanda assigning one of its own inspectors to a request. */
export interface AssignInspectorInput {
  inspectorUserId: string;
  role?: string;
  scheduledAt?: string;
}

/** One row of the cross-project queue BuildPanda works through. */
export interface InspectionRequestSummary {
  id: string;
  projectId: string;
  projectName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  title: string;
  category: string;
  contractorName: string | null;
  serviceStatus: ServiceStatus;
  status: InspectionStatus;
  outcome: InspectionOutcome | null;
  scheduledAt: string;
  reportIssuedAt: string | null;
  requestedById: string | null;
  requestedByName: string | null;
  requestedBySide: RequesterSide;
  inspectorUserId: string | null;
  inspectorName: string | null;
  feeAmount: number | null;
  feeCurrency: string | null;
  createdAt: string;
}

export interface AdminInspectionListParams {
  serviceStatus?: ServiceStatus;
  search?: string;
  unassigned?: boolean;
  limit: number;
  offset: number;
}

export interface AdminInspectionRow extends InspectionRow {
  project_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
  requested_by_name: string | null;
  inspector_user_name: string | null;
}
