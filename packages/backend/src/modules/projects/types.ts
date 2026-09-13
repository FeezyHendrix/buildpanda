import type { CurrencyCode } from "../../lib/currencies.ts";

export type ProjectStatus = "On Track" | "At Risk" | "Delayed";
export type RiskLevel = "Low" | "Medium" | "High";
export type PhaseStatus = "Done" | "InProgress" | "Pending";
export type Currency = CurrencyCode;
export type Tone = "brand" | "orange" | "green" | "purple" | "amber" | "red" | "gray";

// Audience differs per value: `weekly` is the homeowner client update, `daily`
// is the internal end-of-day digest for the build team.
export const AI_UPDATE_CADENCES = ["off", "daily", "weekly", "both"] as const;
export type AiUpdateCadence = (typeof AI_UPDATE_CADENCES)[number];

/** What kind of works this is. A civils job is not a house with roads attached. */
export const PROJECT_TYPES = ["building", "renovation", "civil", "other"] as const;
export type ProjectTypeCode = (typeof PROJECT_TYPES)[number];

export interface ProjectSettings {
  aiUpdateCadence: AiUpdateCadence;
}

/**
 * The contract frame and the working calendar — everything the schedule,
 * missed-day and EOT maths measures against, and none of it editable before.
 */
export interface ProjectProfile {
  name: string;
  address: string;
  startDate: string | null;
  completionDate: string | null;
  revisedCompletionDate: string | null;
  clientName: string | null;
  contractorEntity: string | null;
  projectType: ProjectTypeCode | null;
  /** Day-of-week numbers the site works (0 = Sunday … 6 = Saturday). */
  workingDays: number[];
  /** `yyyy-mm-dd` dates the site is closed. */
  holidays: string[];
  aiUpdateCadence: AiUpdateCadence;
}

export interface UpdateProjectProfileInput {
  name?: string;
  address?: string;
  startDate?: string | null;
  completionDate?: string | null;
  revisedCompletionDate?: string | null;
  clientName?: string | null;
  contractorEntity?: string | null;
  projectType?: ProjectTypeCode | null;
  workingDays?: number[];
  holidays?: string[];
  aiUpdateCadence?: AiUpdateCadence;
}

export interface ProjectPhase {
  id: string;
  name: string;
  status: PhaseStatus;
  dateRange: string;
}

export interface Project {
  id: string;
  ownerId: string | null;
  name: string;
  address: string;
  status: ProjectStatus;
  healthScore: number;
  risk: RiskLevel;
  progressPercent: number;
  budgetTotal: number;
  budgetUsed: number;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: Currency;
  pendingApprovals: number;
  nextInspection: { type: string; date: string };
  folderTone: Tone;
  updatedAt: string;
  createdAt: string;
  timeline: ProjectPhase[];
}

export interface ProjectRow {
  id: string;
  owner_id: string | null;
  organization_id: string | null;
  name: string;
  address: string;
  status: ProjectStatus;
  health_score: number;
  risk: RiskLevel;
  progress_percent: number;
  budget_total: string;
  budget_used: string;
  currency: Currency;
  pending_approvals: number;
  next_inspection_type: string | null;
  next_inspection_date: string | null;
  folder_tone: Tone;
  budget_min: string | null;
  budget_max: string | null;
  setup: ProjectSetup | null;
  ai_update_cadence: AiUpdateCadence;
  start_date: string | null;
  completion_date: string | null;
  revised_completion_date: string | null;
  client_name: string | null;
  contractor_entity: string | null;
  project_type: ProjectTypeCode | null;
  working_days: unknown;
  holidays: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}

/** The two dates an extension of time moves, read on their own. */
export interface ProjectDatesRow {
  completion_date: string | null;
  revised_completion_date: string | null;
}

export interface ProjectPhaseRow {
  id: string;
  project_id: string;
  name: string;
  status: PhaseStatus;
  date_range: string | null;
  sort_order: number;
}

export interface ProjectSetup {
  projectType: string;
  location: {
    state: string;
    city: string;
    ownsLand: boolean;
  };
  buildingType: string;
  timeline: string;
  fundingMethod: string;
  involvementLevel: string;
  riskOptions: string[];
}

export interface CreateProjectInput {
  title: string;
  projectType: string;
  /** Optional project template that seeds stages and starter tasks. */
  templateId?: string;
  location: {
    state: string;
    city: string;
    ownsLand: boolean;
  };
  details: {
    buildingType: string;
    currency: Currency;
    budgetMin: number;
    budgetMax: number;
    timeline: string;
    fundingMethod: string;
  };
  management: {
    involvementLevel: string;
    riskOptions: string[];
  };
}

export interface UpdateProjectBudgetInput {
  budgetMin: number;
  budgetMax: number;
  currency?: Currency;
}
