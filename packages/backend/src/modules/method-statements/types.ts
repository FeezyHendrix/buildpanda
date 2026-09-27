export const SAFETY_DOC_STATUSES = ["draft", "edited", "confirmed"] as const;
export type SafetyDocStatus = (typeof SAFETY_DOC_STATUSES)[number];

export const SAFETY_DOC_ORIGINS = ["ai", "manual", "prompt"] as const;
export type SafetyDocOrigin = (typeof SAFETY_DOC_ORIGINS)[number];

// A scope is one of the two: a proposal before there is a project, or the
// project after handoff. Rows are copied across at conversion, never shared.
export type SafetyScope = { proposalId: string; projectId?: undefined } | { projectId: string; proposalId?: undefined };

export interface MethodStep {
  order: number;
  text: string;
  controls: string;
  ppe: string;
}

export interface MethodStatementRow {
  id: string;
  proposal_id: string | null;
  project_id: string | null;
  activity_name: string;
  programme_task_id: string | null;
  activity_id: string | null;
  hazards: string[];
  steps: MethodStep[];
  origin: SafetyDocOrigin;
  status: SafetyDocStatus;
  confirmed_by: string | null;
  confirmed_at: Date | string | null;
  created_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface MethodStatement {
  id: string;
  proposalId: string | null;
  projectId: string | null;
  activityName: string;
  programmeTaskId: string | null;
  activityId: string | null;
  hazards: string[];
  steps: MethodStep[];
  origin: SafetyDocOrigin;
  status: SafetyDocStatus;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertMethodStatementInput {
  activityName?: string;
  programmeTaskId?: string | null;
  activityId?: string | null;
  hazards?: string[];
  steps?: MethodStep[];
}

export interface EmergencyContact {
  name: string;
  role: string;
  phone: string;
}

export interface PhasePlanRow {
  id: string;
  proposal_id: string | null;
  project_id: string | null;
  key_dates_note: string | null;
  site_rules: string | null;
  welfare: string | null;
  first_aid: string | null;
  services_isolation: string | null;
  asbestos_note: string | null;
  hazards: string[];
  supervision: string | null;
  emergency_contacts: EmergencyContact[];
  origin: SafetyDocOrigin;
  status: SafetyDocStatus;
  confirmed_by: string | null;
  confirmed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface PhasePlan {
  id: string;
  proposalId: string | null;
  projectId: string | null;
  keyDatesNote: string | null;
  siteRules: string | null;
  welfare: string | null;
  firstAid: string | null;
  servicesIsolation: string | null;
  asbestosNote: string | null;
  hazards: string[];
  supervision: string | null;
  emergencyContacts: EmergencyContact[];
  origin: SafetyDocOrigin;
  status: SafetyDocStatus;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertPhasePlanInput {
  keyDatesNote?: string | null;
  siteRules?: string | null;
  welfare?: string | null;
  firstAid?: string | null;
  servicesIsolation?: string | null;
  asbestosNote?: string | null;
  hazards?: string[];
  supervision?: string | null;
  emergencyContacts?: EmergencyContact[];
}

export interface SafetyDraftContext {
  title: string;
  brief: string | null;
  location: string | null;
  structure: string | null;
  programmeTasks: string[];
  programmeTaskIds: Record<string, string>;
}

export interface DraftedMethodStatement {
  activityName: string;
  hazards: string[];
  steps: MethodStep[];
}
