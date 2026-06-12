import api from "./client";

export const PROPOSAL_STATUSES = [
  "New",
  "Preparing",
  "Sent",
  "UnderReview",
  "Revising",
  "Accepted",
  "Converted",
  "Lost",
  "Expired",
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const ESTIMATE_STATUSES = [
  "Draft",
  "Sent",
  "Accepted",
  "Declined",
  "Superseded",
  "Expired",
] as const;

export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export interface ProposalListItem {
  id: string;
  number: number;
  numberLabel: string;
  title: string;
  clientName: string;
  location: string | null;
  status: ProposalStatus;
  currency: string;
  validUntil: string | null;
  createdAt: string;
  estimateTotal: number | null;
}

export interface Proposal {
  id: string;
  orgId: string;
  leadId: string | null;
  projectId: string | null;
  number: number;
  numberLabel: string;
  title: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  location: string | null;
  brief: string | null;
  status: ProposalStatus;
  currency: string;
  validUntil: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EstimateItem {
  id: string;
  estimateId: string;
  groupLabel: string;
  description: string;
  qty: number;
  unit: string;
  unitRate: number;
  total: number;
  boqItemId: string | null;
  sort: number;
}

export interface PaymentScheduleItem {
  id: string;
  estimateId: string;
  label: string;
  percent: number;
  description: string | null;
  sort: number;
}

export interface Estimate {
  id: string;
  proposalId: string;
  revisionNo: number;
  revisionLabel: string;
  status: EstimateStatus;
  contingencyPct: number;
  taxLabel: string;
  taxPct: number;
  changeNote: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  shareToken: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  acceptedByName: string | null;
  createdAt: string;
  updatedAt: string;
  items: EstimateItem[];
  schedule: PaymentScheduleItem[];
}

export interface ProposalEvent {
  id: string;
  proposalId: string;
  type: string;
  actor: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface ProposalWorkspace {
  proposal: Proposal;
  estimate: Estimate | null;
  events: ProposalEvent[];
}

export interface PaginatedProposals {
  total: number;
  rows: ProposalListItem[];
}

export interface CreateProposalInput {
  title: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  location?: string;
  brief?: string;
  currency?: string;
  validUntil?: string;
  leadId?: string;
}

export const proposalsApi = {
  list: (args?: { status?: string; limit?: number; offset?: number }) =>
    api.get<PaginatedProposals>("/proposals", { params: args }).then((r) => r.data),

  create: (body: CreateProposalInput) =>
    api.post<Proposal>("/proposals", body).then((r) => r.data),

  getWorkspace: (id: string) =>
    api.get<ProposalWorkspace>(`/proposals/${id}`).then((r) => r.data),

  patch: (id: string, body: Partial<CreateProposalInput & { status: ProposalStatus; validUntil: string | null }>) =>
    api.patch<Proposal>(`/proposals/${id}`, body).then((r) => r.data),

  delete: (id: string) => api.delete(`/proposals/${id}`),

  createEstimate: (proposalId: string, body: { changeNote?: string }) =>
    api.post<Estimate>(`/proposals/${proposalId}/estimates`, body).then((r) => r.data),

  replaceItems: (proposalId: string, estimateId: string, items: Omit<EstimateItem, "id" | "estimateId" | "total">[]) =>
    api
      .put<EstimateItem[]>(`/proposals/${proposalId}/estimates/${estimateId}/items`, items)
      .then((r) => r.data),

  replaceSchedule: (proposalId: string, estimateId: string, items: Omit<PaymentScheduleItem, "id" | "estimateId">[]) =>
    api
      .put<PaymentScheduleItem[]>(`/proposals/${proposalId}/estimates/${estimateId}/payment-schedule`, items)
      .then((r) => r.data),

  patchEstimate: (
    proposalId: string,
    estimateId: string,
    body: { contingencyPct?: number; taxLabel?: string; taxPct?: number },
  ) =>
    api
      .patch<Estimate>(`/proposals/${proposalId}/estimates/${estimateId}`, body)
      .then((r) => r.data),
};
