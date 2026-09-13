export type ActivityStatus = "Planned" | "InProgress" | "Completed" | "Cancelled";
import type { CurrencyCode } from "../../lib/currencies.ts";
export type Currency = CurrencyCode;

export type DependencyType = "FS" | "SS" | "FF" | "SF";

export interface ActivityDependency {
  activityId: string;
  type: DependencyType;
  lagDays: number;
}

/**
 * Who carries the time risk. It is the single fact that decides whether lost
 * days can be claimed back as an extension of time, so it is attributed on the
 * record rather than inferred from the reason at read time.
 */
export const CULPABILITIES = ["contractor", "client", "neutral"] as const;
export type Culpability = (typeof CULPABILITIES)[number];

export interface ActivityDelay {
  id: string;
  activityId: string;
  reasonCode: string;
  reasonName: string;
  reasonCategory: string;
  description: string | null;
  descriptionHtml: string | null;
  startedAt: string;
  endedAt: string | null;
  daysLost: number;
  culpability: Culpability;
  eotClaimable: boolean;
  linkedRfiId: string | null;
  linkedChangeRequestId: string | null;
  linkedMaterialOrderId: string | null;
  /** Working days this delay has already pushed the programme by; the cascade's ledger. */
  appliedShiftDays: number;
  resolvedAt: string | null;
  resolvedById: string | null;
  costImpact: number;
  currency: Currency;
  preventionNotes: string | null;
  recordedBy: { id: string; name: string | null } | null;
  createdAt: string;
}

export interface Activity {
  id: string;
  projectId: string;
  phaseId: string | null;
  phaseName: string | null;
  name: string;
  activityType: string;
  location: string | null;
  status: ActivityStatus;
  isSummary: boolean;
  isDelayed: boolean;
  plannedStartAt: string;
  plannedEndAt: string;
  actualStartAt: string | null;
  actualEndAt: string | null;
  workerCountPlanned: number;
  assigneeId: string | null;
  assigneeName: string | null;
  notes: string | null;
  wbsCode: string | null;
  outlineLevel: number | null;
  parentActivityId: string | null;
  predecessors: ActivityDependency[];
  percentComplete: number;
  durationDays: number | null;
  baselineStartAt: string | null;
  baselineEndAt: string | null;
  isMilestone: boolean;
  source: string;
  /** Planned duration counted on the project's working calendar, both ends inclusive. */
  durationWorkingDays: number;
  delays: ActivityDelay[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivityRow {
  id: string;
  project_id: string;
  building_id: string;
  phase_id: string | null;
  name: string;
  activity_type: string;
  location: string | null;
  status: ActivityStatus;
  planned_start_at: Date | string;
  planned_end_at: Date | string;
  actual_start_at: Date | string | null;
  actual_end_at: Date | string | null;
  worker_count_planned: number;
  assignee_id: string | null;
  assignee_name?: string | null;
  notes: string | null;
  wbs_code: string | null;
  outline_level: number | null;
  parent_activity_id: string | null;
  predecessors: ActivityDependency[] | string;
  percent_complete: string | number;
  duration_days: string | number | null;
  baseline_start_at: Date | string | null;
  baseline_end_at: Date | string | null;
  is_milestone: boolean;
  source: string;
  created_by_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ActivityDelayRow {
  id: string;
  activity_id: string;
  reason_code: string;
  description: string | null;
  description_html: string | null;
  started_at: Date | string;
  ended_at: Date | string | null;
  days_lost: number;
  culpability: Culpability;
  eot_claimable: boolean;
  linked_rfi_id: string | null;
  linked_change_request_id: string | null;
  linked_material_order_id: string | null;
  applied_shift_days: number;
  resolved_at: Date | string | null;
  resolved_by_id: string | null;
  cost_impact: string;
  currency: Currency;
  prevention_notes: string | null;
  recorded_by_id: string | null;
  /** Joined from the user table so a delay record says who logged it. */
  recorded_by_name?: string | null;
  created_at: Date | string;
}

export interface DelayReasonRow {
  code: string;
  category: string;
  name: string;
  default_culpability?: Culpability;
  default_eot_claimable?: boolean;
}

/** One line of the programme's audit trail: who moved what, by how many days, why. */
export interface ActivityEventRow {
  id: string;
  project_id: string;
  activity_id: string;
  kind: string;
  summary: string;
  days_delta: number;
  delay_id: string | null;
  actor_id: string | null;
  created_at: Date | string;
}

export interface CreateActivityInput {
  name: string;
  activityType: string;
  buildingId?: string | null;
  phaseId?: string | null;
  location?: string;
  status?: ActivityStatus;
  plannedStartAt: string;
  plannedEndAt: string;
  workerCountPlanned?: number;
  assigneeId?: string | null;
  notes?: string;
  wbsCode?: string | null;
  outlineLevel?: number | null;
  parentActivityId?: string | null;
  predecessors?: ActivityDependency[];
  percentComplete?: number;
  durationDays?: number | null;
  baselineStartAt?: string | null;
  baselineEndAt?: string | null;
  isMilestone?: boolean;
  source?: string;
}

export interface UpdateActivityInput {
  name?: string;
  activityType?: string;
  phaseId?: string | null;
  location?: string | null;
  status?: ActivityStatus;
  plannedStartAt?: string;
  plannedEndAt?: string;
  actualStartAt?: string | null;
  actualEndAt?: string | null;
  workerCountPlanned?: number;
  assigneeId?: string | null;
  notes?: string | null;
  predecessors?: ActivityDependency[];
  percentComplete?: number;
  isMilestone?: boolean;
}

export interface RaiseDelayInput {
  reasonCode: string;
  description?: string;
  descriptionHtml?: string | null;
  startedAt: string;
  endedAt?: string | null;
  daysLost?: number;
  culpability?: Culpability;
  eotClaimable?: boolean;
  linkedRfiId?: string | null;
  linkedChangeRequestId?: string | null;
  linkedMaterialOrderId?: string | null;
  costImpact?: number;
  currency?: Currency;
  preventionNotes?: string;
}

export interface ResolveDelayInput {
  resolvedAt?: string;
  endedAt?: string | null;
  daysLost?: number;
  culpability?: Culpability;
  eotClaimable?: boolean;
  linkedRfiId?: string | null;
  linkedChangeRequestId?: string | null;
  linkedMaterialOrderId?: string | null;
  preventionNotes?: string;
}

/** One activity the cascade moved, and by how many working days. */
export interface ShiftedActivity {
  id: string;
  name: string;
  days: number;
  plannedEndAt: string;
}
