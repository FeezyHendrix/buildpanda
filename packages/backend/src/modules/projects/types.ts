export type ProjectStatus = "On Track" | "At Risk" | "Delayed";
export type RiskLevel = "Low" | "Medium" | "High";
export type PhaseStatus = "Done" | "InProgress" | "Pending";
export type Currency = "NGN" | "USD";
export type Tone = "brand" | "orange" | "green" | "purple" | "amber" | "red" | "gray";

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
  created_at: Date | string;
  updated_at: Date | string;
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
