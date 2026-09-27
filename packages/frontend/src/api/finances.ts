import api from "./client";
import type {
  CashFlowCategory,
  CashFlowEntry,
  FinanceEvent,
  MilestoneStatus,
  MilestoneDispute,
  MilestonePayment,
  ProjectFinances,
  SignOffStatus,
  UpdateContractTermsInput,
} from "@/lib/project-types";

export interface AddCashFlowVariables {
  projectId: string;
  category: CashFlowCategory;
  amount: number;
  isCredit: boolean;
  description?: string;
  entryDate?: string;
}

export interface DepositVariables {
  projectId: string;
  amount: number;
  description?: string;
}

export interface UpsertMilestoneInput {
  projectId: string;
  milestoneId?: string;
  name: string;
  phase: string;
  amount: number;
  percentComplete?: number;
  status?: MilestoneStatus;
  inspectorSignOff?: SignOffStatus;
}

export interface DeleteMilestoneInput {
  projectId: string;
  milestoneId: string;
}

export interface ReleaseVariables {
  projectId: string;
  milestoneId: string;
}

export interface RaiseDisputeVariables {
  projectId: string;
  milestoneId: string;
  reason: string;
}

export interface UpdateContractSumVariables {
  projectId: string;
  contractSum: number;
}

export interface RecordVariationVariables {
  projectId: string;
  amount: number;
  description: string;
}

export interface StageCost {
  stageId: string;
  committed: number;
  actual: number;
  currency: string;
}

export interface StageCostsResponse {
  stages: StageCost[];
}

// ── The one money model ───────────────────────────────────────────────────
// `GET /finances/summary` is the single contract position. Certification comes
// only from approved receivable certificates and payment only from the
// receipts recorded on them; deposits and milestone releases sit in `funding`
// and never feed the waterfall. Nothing on screen recomputes these figures.

/** Funding put into the project and released from it. Never part of the waterfall. */
export interface FundingPosition {
  deposited: number;
  released: number;
}

/** Liquidated damages the employer could levy: days late × rate, capped. */
export interface LdExposure {
  daysLate: number;
  ratePerDay: number;
  capAmount: number | null;
  amount: number;
  /** The date lateness is measured against — the revised completion when an EOT moved it. */
  againstDate: string;
}

export interface EotPosition {
  daysApproved: number;
  daysPending: number;
}

/** Cost against budget for one build stage, saying where the budget figure came from. */
export interface StageBudgetLine {
  stageId: string;
  name: string;
  scheduledValue: number;
  budget: number;
  /** "scheduled_value" when nobody entered an estimate and the value stands in. */
  budgetSource: "expected_cost" | "scheduled_value";
  committed: number;
  actual: number;
  variance: number;
}

export interface FinanceSummary {
  projectId: string;
  currency: string;
  contractSum: number;
  variationsTotal: number;
  adjustedContract: number;
  /** Gross certified: the sum of Approved/Paid receivable invoices, voided ones excluded. */
  certifiedGrossToDate: number;
  /** Payments recorded against those receivable invoices. */
  amountPaidToDate: number;
  retentionHeld: number;
  advanceRecovered: number;
  /** Still to certify: adjusted contract − certified. */
  outstanding: number;
  /** Certified but not yet received. */
  unpaidCertified: number;
  funding: FundingPosition;
  ldExposure: LdExposure | null;
  eot: EotPosition | null;
  completionDate: string | null;
  revisedCompletionDate: string | null;
  phases: StageBudgetLine[];
}

export const financesApi = {
  stageCosts: (projectId: string) =>
    api.get<StageCostsResponse>(`/projects/${projectId}/finances/stage-costs`).then((r) => r.data),

  cashFlow: {
    list: (projectId: string) =>
      api.get<CashFlowEntry[]>(`/projects/${projectId}/finances/cash-flow`).then((r) => r.data),

    create: (projectId: string, body: Omit<AddCashFlowVariables, "projectId">) =>
      api.post<CashFlowEntry>(`/projects/${projectId}/finances/cash-flow`, body).then((r) => r.data),
  },

  summary: (projectId: string) =>
    api.get<ProjectFinances>(`/projects/${projectId}/finances`).then((r) => r.data),

  /** The one money model: the contract position every finance surface reads. */
  position: (projectId: string) =>
    api.get<FinanceSummary>(`/projects/${projectId}/finances/summary`).then((r) => r.data),

  events: (projectId: string) =>
    api.get<FinanceEvent[]>(`/projects/${projectId}/finances/events`).then((r) => r.data),

  milestoneDisputes: (projectId: string, milestoneId: string) =>
    api.get<MilestoneDispute[]>(`/projects/${projectId}/finances/milestones/${milestoneId}/disputes`).then((r) => r.data),

  deposit: (projectId: string, body: { amount: number; description?: string }) =>
    api.post<ProjectFinances>(`/projects/${projectId}/finances/deposits`, body).then((r) => r.data),

  upsertMilestone: (projectId: string, milestoneId: string | undefined, body: Omit<UpsertMilestoneInput, "projectId" | "milestoneId">) =>
    milestoneId
      ? api.patch<MilestonePayment>(`/projects/${projectId}/finances/milestones/${milestoneId}`, body).then((r) => r.data)
      : api.post<MilestonePayment>(`/projects/${projectId}/finances/milestones`, body).then((r) => r.data),

  deleteMilestone: (projectId: string, milestoneId: string) =>
    api.delete(`/projects/${projectId}/finances/milestones/${milestoneId}`).then((r) => r.data),

  releaseMilestone: (projectId: string, milestoneId: string) =>
    api.post<MilestonePayment>(`/projects/${projectId}/finances/milestones/${milestoneId}/release`).then((r) => r.data),

  raiseDispute: (projectId: string, milestoneId: string, body: { reason: string }) =>
    api.post<MilestoneDispute>(`/projects/${projectId}/finances/milestones/${milestoneId}/disputes`, body).then((r) => r.data),

  updateContractSum: (projectId: string, contractSum: number) =>
    api.post<ProjectFinances>(`/projects/${projectId}/finances/contract-sum`, { contractSum }).then((r) => r.data),

  recordVariation: (projectId: string, amount: number, description: string) =>
    api.post<ProjectFinances>(`/projects/${projectId}/finances/variations`, { amount, description }).then((r) => r.data),

  updateContractTerms: (projectId: string, body: UpdateContractTermsInput) =>
    api
      .put<ProjectFinances>(`/projects/${projectId}/finances/contract-terms`, body)
      .then((r) => r.data),
};
