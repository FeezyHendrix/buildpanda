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

export interface ProposalRow {
  id: string;
  org_id: string;
  lead_id: string | null;
  project_id: string | null;
  number: number;
  title: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  location: string | null;
  brief: string | null;
  status: ProposalStatus;
  currency: string;
  valid_until: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Proposal {
  id: string;
  orgId: string;
  leadId: string | null;
  projectId: string | null;
  number: number;
  numberLabel: string; // "BP-0012"
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

export interface EstimateRow {
  id: string;
  proposal_id: string;
  revision_no: number;
  status: EstimateStatus;
  contingency_pct: number | string;
  tax_label: string | null;
  tax_pct: number | string;
  change_note: string | null;
  subtotal: number | string;
  tax_amount: number | string;
  total: number | string;
  share_token: string | null;
  share_token_expires_at: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  accepted_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Estimate {
  id: string;
  proposalId: string;
  revisionNo: number;
  revisionLabel: string; // "Rev 1"
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
}

export interface EstimateItemRow {
  id: string;
  estimate_id: string;
  group_label: string;
  description: string;
  qty: number | string;
  unit: string;
  unit_rate: number | string;
  total: number | string;
  boq_item_id: string | null;
  sort: number;
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

export interface PaymentScheduleRow {
  id: string;
  estimate_id: string;
  label: string;
  percent: number | string;
  description: string | null;
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

export interface ProposalEventRow {
  id: string;
  proposal_id: string;
  type: string;
  actor: string | null;
  metadata: unknown;
  created_at: string;
}

export interface ProposalEvent {
  id: string;
  proposalId: string;
  type: string;
  actor: string | null;
  metadata: unknown;
  createdAt: string;
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

export interface CreateEstimateItemInput {
  groupLabel: string;
  description: string;
  qty: number;
  unit: string;
  unitRate: number;
  boqItemId?: string;
  sort?: number;
}

export interface CreatePaymentScheduleInput {
  label: string;
  percent: number;
  description?: string;
  sort?: number;
}
