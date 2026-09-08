import api from "./client";

export const RISK_LEVELS_3 = ["low", "medium", "high"] as const;
export type RiskLevel3 = (typeof RISK_LEVELS_3)[number];

export const RISK_STATUSES = ["open", "mitigated", "closed"] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

export type SafetyOrigin = "ai" | "manual" | "prompt";
export type RiskEditState = "ai_draft" | "edited" | "confirmed";
export type SafetyDocStatus = "draft" | "edited" | "confirmed";

export interface ProposalRisk {
  id: string;
  projectId: string | null;
  proposalId: string | null;
  title: string;
  description: string;
  descriptionHtml: string | null;
  severity: "Low" | "Medium" | "High";
  likelihood: RiskLevel3 | null;
  impact: RiskLevel3 | null;
  score: number | null;
  ownerId: string | null;
  ownerName: string | null;
  mitigation: string | null;
  status: RiskStatus;
  reviewDate: string | null;
  origin: SafetyOrigin;
  editState: RiskEditState;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RiskInput {
  title?: string;
  description?: string;
  likelihood?: RiskLevel3 | null;
  impact?: RiskLevel3 | null;
  ownerName?: string | null;
  mitigation?: string | null;
  status?: RiskStatus;
  reviewDate?: string | null;
}

export interface MethodStep {
  order: number;
  text: string;
  controls: string;
  ppe: string;
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
  origin: SafetyOrigin;
  status: SafetyDocStatus;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MethodStatementInput {
  activityName?: string;
  programmeTaskId?: string | null;
  hazards?: string[];
  steps?: MethodStep[];
}

export interface EmergencyContact {
  name: string;
  role: string;
  phone: string;
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
  origin: SafetyOrigin;
  status: SafetyDocStatus;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PhasePlanInput = Partial<
  Pick<
    PhasePlan,
    | "keyDatesNote"
    | "siteRules"
    | "welfare"
    | "firstAid"
    | "servicesIsolation"
    | "asbestosNote"
    | "hazards"
    | "supervision"
    | "emergencyContacts"
  >
>;

const base = (proposalId: string) => `/proposals/${proposalId}`;

export const preconSafetyApi = {
  listRisks: (proposalId: string) => api.get<ProposalRisk[]>(`${base(proposalId)}/risks`).then((r) => r.data),
  createRisk: (proposalId: string, body: RiskInput & { title: string; description: string }) =>
    api.post<ProposalRisk>(`${base(proposalId)}/risks`, body).then((r) => r.data),
  updateRisk: (proposalId: string, riskId: string, body: RiskInput) =>
    api.put<ProposalRisk>(`${base(proposalId)}/risks/${riskId}`, body).then((r) => r.data),
  confirmRisk: (proposalId: string, riskId: string) =>
    api.post<ProposalRisk>(`${base(proposalId)}/risks/${riskId}/confirm`).then((r) => r.data),
  deleteRisk: (proposalId: string, riskId: string) =>
    api.delete(`${base(proposalId)}/risks/${riskId}`).then((r) => r.data),
  draftRisks: (proposalId: string) => api.post<ProposalRisk[]>(`${base(proposalId)}/risks/draft`).then((r) => r.data),

  listStatements: (proposalId: string) =>
    api.get<MethodStatement[]>(`${base(proposalId)}/method-statements`).then((r) => r.data),
  createStatement: (proposalId: string, body: MethodStatementInput & { activityName: string }) =>
    api.post<MethodStatement>(`${base(proposalId)}/method-statements`, body).then((r) => r.data),
  updateStatement: (proposalId: string, statementId: string, body: MethodStatementInput) =>
    api.put<MethodStatement>(`${base(proposalId)}/method-statements/${statementId}`, body).then((r) => r.data),
  confirmStatement: (proposalId: string, statementId: string) =>
    api.post<MethodStatement>(`${base(proposalId)}/method-statements/${statementId}/confirm`).then((r) => r.data),
  deleteStatement: (proposalId: string, statementId: string) =>
    api.delete(`${base(proposalId)}/method-statements/${statementId}`).then((r) => r.data),
  draftStatements: (proposalId: string) =>
    api.post<MethodStatement[]>(`${base(proposalId)}/method-statements/draft`).then((r) => r.data),

  phasePlan: (proposalId: string) => api.get<PhasePlan | null>(`${base(proposalId)}/phase-plan`).then((r) => r.data),
  savePhasePlan: (proposalId: string, body: PhasePlanInput) =>
    api.put<PhasePlan>(`${base(proposalId)}/phase-plan`, body).then((r) => r.data),
  confirmPhasePlan: (proposalId: string) =>
    api.post<PhasePlan>(`${base(proposalId)}/phase-plan/confirm`).then((r) => r.data),
  draftPhasePlan: (proposalId: string) => api.post<PhasePlan>(`${base(proposalId)}/phase-plan/draft`).then((r) => r.data),
};
