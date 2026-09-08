import type { RiskLevel } from "../projects/types.ts";

export const RISK_LIKELIHOODS = ["low", "medium", "high"] as const;
export type RiskLikelihood = (typeof RISK_LIKELIHOODS)[number];

export const RISK_IMPACTS = ["low", "medium", "high"] as const;
export type RiskImpact = (typeof RISK_IMPACTS)[number];

export const RISK_STATUSES = ["open", "mitigated", "closed"] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

export const RISK_ORIGINS = ["ai", "manual", "prompt"] as const;
export type RiskOrigin = (typeof RISK_ORIGINS)[number];

// Where a row stands between the AI's draft and a person's sign-off. Derived,
// never stored: confirmed_at set = confirmed; edited after an AI draft = edited.
export const RISK_EDIT_STATES = ["ai_draft", "edited", "confirmed"] as const;
export type RiskEditState = (typeof RISK_EDIT_STATES)[number];

export interface RiskFactor {
  id: string;
  projectId: string | null;
  proposalId: string | null;
  title: string;
  description: string;
  descriptionHtml: string | null;
  severity: RiskLevel;
  likelihood: RiskLikelihood | null;
  impact: RiskImpact | null;
  score: number | null;
  ownerId: string | null;
  ownerName: string | null;
  mitigation: string | null;
  status: RiskStatus;
  reviewDate: string | null;
  origin: RiskOrigin;
  editState: RiskEditState;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RiskFactorRow {
  id: string;
  project_id: string | null;
  proposal_id: string | null;
  title: string;
  description: string;
  description_html: string | null;
  severity: RiskLevel;
  likelihood: RiskLikelihood | null;
  impact: RiskImpact | null;
  owner_id: string | null;
  owner_name: string | null;
  mitigation: string | null;
  status: RiskStatus;
  review_date: Date | string | null;
  origin: RiskOrigin;
  confirmed_by: string | null;
  confirmed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface CreateRiskInput {
  title: string;
  description: string;
  descriptionHtml?: string | null;
  severity?: RiskLevel;
  likelihood?: RiskLikelihood | null;
  impact?: RiskImpact | null;
  ownerId?: string | null;
  ownerName?: string | null;
  mitigation?: string | null;
  status?: RiskStatus;
  reviewDate?: string | null;
}

export interface EditRiskInput {
  title?: string;
  description?: string;
  descriptionHtml?: string | null;
  severity?: RiskLevel;
  likelihood?: RiskLikelihood | null;
  impact?: RiskImpact | null;
  ownerId?: string | null;
  ownerName?: string | null;
  mitigation?: string | null;
  status?: RiskStatus;
  reviewDate?: string | null;
}

// What the drafter is given about the job. Everything is optional so a bare
// proposal with only a brief still gets a usable register.
export interface RiskDraftContext {
  title: string;
  brief: string | null;
  location: string | null;
  structure: string | null;
  programmeTasks: string[];
}

export interface DraftedRisk {
  title: string;
  description: string;
  likelihood: RiskLikelihood;
  impact: RiskImpact;
  mitigation: string;
}
