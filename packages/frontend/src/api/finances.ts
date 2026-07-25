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

export const financesApi = {
  cashFlow: {
    list: (projectId: string) =>
      api.get<CashFlowEntry[]>(`/projects/${projectId}/finances/cash-flow`).then((r) => r.data),

    create: (projectId: string, body: Omit<AddCashFlowVariables, "projectId">) =>
      api.post<CashFlowEntry>(`/projects/${projectId}/finances/cash-flow`, body).then((r) => r.data),
  },

  summary: (projectId: string) =>
    api.get<ProjectFinances>(`/projects/${projectId}/finances`).then((r) => r.data),

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
};
