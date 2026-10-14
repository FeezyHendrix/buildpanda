import type { RiskLevel, Currency, ActivityStatus, WeatherCondition } from "./common";

export const RISK_STATUSES = ["open", "mitigated", "closed", "occurred"] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

export interface RiskFactor {
  id: string;
  title: string;
  description: string;
  descriptionHtml: string | null;
  severity: RiskLevel;
  status: RiskStatus;
  ownerId: string | null;
  ownerName: string | null;
  mitigation: string | null;
  reviewDate: string | null;
  linkedActivityId: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Who carries the time risk. A contractor-culpable delay can never be EOT-claimable. */
export const CULPABILITIES = ["contractor", "client", "neutral"] as const;
export type Culpability = (typeof CULPABILITIES)[number];

export interface ActivityDelay {
  id: string;
  activityId: string;
  reasonCode: string;
  reasonName: string;
  reasonCategory: string;
  description: string | null;
  descriptionHtml?: string | null;
  startedAt: string;
  /** When work resumed; null while the delay is still running. */
  endedAt: string | null;
  /** Measured lost time, in working days on the project calendar. */
  daysLost: number;
  culpability: Culpability;
  eotClaimable: boolean;
  linkedRfiId: string | null;
  linkedChangeRequestId: string | null;
  linkedMaterialOrderId: string | null;
  /** Working days this delay has already pushed the chain by — the cascade's ledger. */
  appliedShiftDays: number;
  resolvedAt: string | null;
  resolvedById: string | null;
  costImpact: number;
  currency: Currency;
  preventionNotes: string | null;
  recordedBy: { id: string; name: string | null } | null;
  createdAt: string;
}

/** One line of the programme audit trail: who moved what, by how many days, and why. */
export interface ActivityEvent {
  id: string;
  activityId: string;
  kind: string;
  summary: string;
  daysDelta: number;
  delayId: string | null;
  actorId: string | null;
  createdAt: string;
}

export type ActivityDependencyType = "FS" | "SS" | "FF" | "SF";

export interface ActivityDependency {
  activityId: string;
  type: ActivityDependencyType;
  lagDays: number;
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
  /** Planned duration on the project's working calendar, both ends inclusive. */
  durationWorkingDays: number;
  delays: ActivityDelay[];
  createdAt: string;
  updatedAt: string;
}

/** `GET /delay-reasons` answers with the raw rows, so these stay snake_case. */
export interface DelayReason {
  code: string;
  category: string;
  name: string;
  description: string;
  is_active?: boolean;
  default_culpability?: Culpability;
  default_eot_claimable?: boolean;
}

export interface DailyLogActivityLink {
  activityId: string;
  activityName: string;
  hoursLogged: number;
}

export interface DailyLog {
  projectId: string;
  logDate: string;
  weatherCondition: WeatherCondition | null;
  temperatureC: number | null;
  precipitationMm: number | null;
  windKph: number | null;
  workersExpected: number;
  workersPresent: number;
  totalHours: number;
  summary: string | null;
  summaryHtml: string | null;
  activities: DailyLogActivityLink[];
  voidedAt: string | null;
  voidedById: string | null;
  voidedByName: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyLogEntryVoid {
  id: string;
  reason: string;
  voidedById: string | null;
  voidedByName: string;
  voidedAt: string;
}

export interface DailyLogEntry {
  id: string;
  projectId: string;
  logDate: string;
  authorId: string | null;
  authorName: string;
  authorRole: string;
  bodyHtml: string | null;
  bodyText: string | null;
  /** Set when filled from a template; the body is the rendered form. */
  templateId?: string | null;
  templateName?: string | null;
  voids: DailyLogEntryVoid[];
  voided: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DailyLogDay {
  projectId: string;
  logDate: string;
  weatherCondition: WeatherCondition | null;
  temperatureC: number | null;
  precipitationMm: number | null;
  windKph: number | null;
  workersExpected: number;
  workersPresent: number;
  totalHours: number;
  activities: DailyLogActivityLink[];
  entries: DailyLogEntry[];
  voidedAt: string | null;
}
