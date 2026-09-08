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
  description_html: string | null;
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
  descriptionHtml: string | null;
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
  description_html: string | null;
  sort: number;
}

export interface PaymentScheduleItem {
  id: string;
  estimateId: string;
  label: string;
  percent: number;
  description: string | null;
  descriptionHtml: string | null;
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
  descriptionHtml?: string | null;
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
  descriptionHtml?: string | null;
  sort?: number;
}

export interface ProposalPlanRow {
  id: string;
  proposal_id: string;
  file_id: string;
  label: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  sort: number;
}

export interface ProposalPlan {
  id: string;
  proposalId: string;
  fileId: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  label: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
  sort: number;
}

export interface CreateProposalPlanInput {
  fileId: string;
  label?: string;
}

export interface ProposalBoqItemRow {
  id: string;
  proposal_id: string;
  group_label: string;
  description: string;
  description_html: string | null;
  qty: number | string;
  unit: string;
  sort: number;
}

export interface ProposalBoqItem {
  id: string;
  proposalId: string;
  groupLabel: string;
  description: string;
  descriptionHtml: string | null;
  qty: number;
  unit: string;
  sort: number;
}

export interface CreateBoqItemInput {
  groupLabel: string;
  description: string;
  descriptionHtml?: string | null;
  qty: number;
  unit: string;
  sort?: number;
}

// ---------- proposal → project handoff ----------

export const JOB_PROFILES = ["full_contract", "labour_only", "supply_only"] as const;
export type JobProfile = (typeof JOB_PROFILES)[number];

export const CONVERT_SECTIONS = [
  "programme",
  "milestones",
  "budget",
  "materials",
  "drawings",
  "documents",
  "permits",
  "selections",
  "client",
] as const;
export type ConvertSection = (typeof CONVERT_SECTIONS)[number];
export type ConvertInclude = Partial<Record<ConvertSection, boolean>>;

export interface ConvertBody {
  include?: ConvertInclude;
}

export interface ConvertPreviewSection {
  key: ConvertSection;
  label: string;
  count: number;
  detail: string;
  available: boolean;
}

export interface ConvertPreview {
  proposalId: string;
  alreadyConverted: boolean;
  projectId: string | null;
  sections: ConvertPreviewSection[];
  setup: { projectType: string; buildingType: string; timeline: string; source: string };
  contractSum: number;
  currency: string;
  warnings: string[];
}

export interface ConvertProgrammeSeed {
  phases: Array<{
    id: string;
    project_id: string;
    building_id: string;
    name: string;
    status: string;
    date_range: string;
    start_date: string;
    end_date: string;
    sort_order: number;
    programme_task_id: string;
  }>;
  activities: Array<{
    id: string;
    project_id: string;
    building_id: string;
    phase_id: string | null;
    name: string;
    activity_type: string;
    location: null;
    status: string;
    planned_start_at: string;
    planned_end_at: string;
    worker_count_planned: number;
    notes: string | null;
    wbs_code: string | null;
    outline_level: number;
    parent_activity_id: string | null;
    predecessors: string;
    percent_complete: number;
    duration_days: number;
    baseline_start_at: string;
    baseline_end_at: string;
    is_milestone: boolean;
    source: string;
    created_by_id: string;
    programme_task_id: string;
  }>;
  keyDates: Array<{
    id: string;
    project_id: string;
    building_id: string;
    label: string;
    target_date: string;
    actual_date: null;
    status: string;
    notes: null;
    sort_order: number;
    programme_task_id: string | null;
  }>;
  phaseIdByTaskId: Map<string, string>;
  activityIdByTaskId: Map<string, string>;
}

export interface ConvertMaterialSeed {
  orders: Array<Record<string, unknown>>;
  longLeadCount: number;
}

export interface ConvertPlanSeed {
  documents: Array<Record<string, unknown>>;
  versions: Array<Record<string, unknown>>;
}
