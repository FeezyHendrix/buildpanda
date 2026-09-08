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

export const SCHEDULE_KINDS = ["advance", "stage"] as const;
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number];

export interface PaymentScheduleItem {
  id: string;
  estimateId: string;
  label: string;
  percent: number;
  description: string | null;
  sort: number;
  kind: ScheduleKind;
  programmeTaskId: string | null;
}

export const RETENTION_MODES = ["none", "cash", "bond"] as const;
export type RetentionMode = (typeof RETENTION_MODES)[number];
export const CLIENT_VISIBLE_DETAIL = ["groups", "lines"] as const;
export type ClientVisibleDetail = (typeof CLIENT_VISIBLE_DETAIL)[number];
export const WHT_RATES = [0, 2, 5] as const;

export interface EstimateTerms {
  retentionPct: number | null;
  retentionMode: RetentionMode | null;
  advancePct: number | null;
  whtPct: number | null;
  paymentTermsDays: number | null;
  defectsLiabilityDays: number | null;
  clientVisibleDetail: ClientVisibleDetail;
}

export interface UpdateEstimateTermsInput extends Partial<EstimateTerms> {
  validUntil?: string | null;
}

export interface Estimate extends EstimateTerms {
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
  acceptedIp: string | null;
  acceptedUserAgent: string | null;
  acceptedPdfHash: string | null;
  snapshotFileId: string | null;
  responseMessage: string | null;
  createdAt: string;
  updatedAt: string;
  items: EstimateItem[];
  schedule: PaymentScheduleItem[];
}

export const PACK_SECTION_KINDS = [
  "scope",
  "exclusions",
  "assumptions",
  "provisional_sums",
  "warranties",
  "terms",
  "site_survey",
] as const;
export type PackSectionKind = (typeof PACK_SECTION_KINDS)[number];
export type PackOrigin = "ai" | "manual" | "prompt" | "template";

export interface PackSection {
  id: string;
  proposalId: string;
  estimateId: string | null;
  kind: PackSectionKind;
  bodyHtml: string;
  sort: number;
  origin: PackOrigin;
  updatedBy: string | null;
  updatedAt: string;
}

export interface PublicCompany {
  name: string;
  logo: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  website: string | null;
  insuranceReference: string | null;
}

export interface BuyingListLine {
  description: string;
  qty: number;
  unit: string;
  section: string | null;
}

export type ClientResponse = "accept" | "decline" | "change_requested";

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

export type TakeoffStatus = "pending" | "processing" | "completed" | "failed";

export interface TakeoffJob {
  id: string;
  proposalId: string | null;
  projectId: string | null;
  fileId: string | null;
  status: TakeoffStatus;
  fileName: string;
  drawingCount: number;
  elementCount: number;
  error: string | null;
  result: {
    drawings: Array<{ id: number; kind: string; widthM: number; heightM: number; entityCount: number }>;
    selectedDrawingId: number | null;
    items: Array<{ trade: string; description: string; quantity: number; unit: string; confidence: string; basis: string }>;
    notes: string[];
  } | null;
  createdAt: string;
  updatedAt: string;
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

export interface ProposalComment {
  id: string;
  proposalId: string;
  authorId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface PublicProposalView {
  proposal: Proposal & { jobProfile: string };
  estimate: Estimate;
  company: PublicCompany;
  sections: PackSection[];
  buyingList: BuyingListLine[];
  viewCount: number;
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

  replaceSchedule: (
    proposalId: string,
    estimateId: string,
    items: Array<Omit<PaymentScheduleItem, "id" | "estimateId" | "description"> & { description?: string }>,
  ) =>
    api
      .put<PaymentScheduleItem[]>(`/proposals/${proposalId}/estimates/${estimateId}/payment-schedule`, items)
      .then((r) => r.data),

  patchEstimateTerms: (proposalId: string, estimateId: string, body: UpdateEstimateTermsInput) =>
    api.patch<Estimate>(`/proposals/${proposalId}/estimates/${estimateId}/terms`, body).then((r) => r.data),

  listPack: (proposalId: string) => api.get<PackSection[]>(`/proposals/${proposalId}/pack`).then((r) => r.data),

  upsertPackSection: (proposalId: string, body: { kind: PackSectionKind; bodyHtml: string; origin?: PackOrigin }) =>
    api.put<PackSection>(`/proposals/${proposalId}/pack`, body).then((r) => r.data),

  deletePackSection: (proposalId: string, kind: PackSectionKind) =>
    api.delete(`/proposals/${proposalId}/pack/${kind}`).then((r) => r.data),

  draftPack: (proposalId: string, kinds?: PackSectionKind[]) =>
    api.post<PackSection[]>(`/proposals/${proposalId}/pack/draft`, { kinds }).then((r) => r.data),

  patchEstimate: (
    proposalId: string,
    estimateId: string,
    body: { contingencyPct?: number; taxLabel?: string; taxPct?: number },
  ) =>
    api
      .patch<Estimate>(`/proposals/${proposalId}/estimates/${estimateId}`, body)
      .then((r) => r.data),

  sendEstimate: (proposalId: string, estimateId: string) =>
    api
      .post<{ shareUrl: string; token: string; snapshotFileId: string; pdfHash: string }>(
        `/proposals/${proposalId}/estimates/${estimateId}/send`,
      )
      .then((r) => r.data),

  listComments: (proposalId: string) =>
    api.get<ProposalComment[]>(`/proposals/${proposalId}/comments`).then((r) => r.data),

  postComment: (proposalId: string, body: string) =>
    api.post<ProposalComment>(`/proposals/${proposalId}/comments`, { body }).then((r) => r.data),

  convert: (proposalId: string, include?: ConvertInclude) =>
    api
      .post<{ projectId: string; clientInvited?: boolean }>(`/proposals/${proposalId}/convert`, include ? { include } : {})
      .then((r) => r.data),

  convertPreview: (proposalId: string) =>
    api.post<ConvertPreview>(`/proposals/${proposalId}/convert/preview`).then((r) => r.data),

  listPlans: (proposalId: string) =>
    api.get<ProposalPlan[]>(`/proposals/${proposalId}/plans`).then((r) => r.data),

  addPlan: (proposalId: string, body: { fileId: string; label?: string }) =>
    api.post<ProposalPlan[]>(`/proposals/${proposalId}/plans`, body).then((r) => r.data),

  deletePlan: (proposalId: string, planId: string) =>
    api.delete(`/proposals/${proposalId}/plans/${planId}`),

  startAutomatedTakeoff: (proposalId: string, planId: string) =>
    api.post<TakeoffJob>(`/proposals/${proposalId}/plans/${planId}/automated-takeoff`).then((r) => r.data),

  listAutomatedTakeoffs: (proposalId: string) =>
    api.get<TakeoffJob[]>(`/proposals/${proposalId}/automated-takeoff`).then((r) => r.data),

  exportBoq: (proposalId: string) =>
    api.get(`/proposals/${proposalId}/boq/export`, { responseType: "blob" }).then((r) => r.data as Blob),

  listBoq: (proposalId: string) =>
    api.get<ProposalBoqItem[]>(`/proposals/${proposalId}/boq`).then((r) => r.data),

  replaceBoq: (proposalId: string, items: Omit<ProposalBoqItem, "id" | "proposalId">[]) =>
    api.put<ProposalBoqItem[]>(`/proposals/${proposalId}/boq`, items).then((r) => r.data),

  // Public endpoints — no auth required
  getPublic: (token: string) =>
    api.get<PublicProposalView>(`/proposals/public/${token}`).then((r) => r.data),

  respond: (token: string, body: { action: ClientResponse; name?: string; message?: string }) =>
    api
      .post<{ ok: boolean; action: string; acceptedAt: string | null }>(`/proposals/public/${token}/respond`, body)
      .then((r) => r.data),
};

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

export interface ProposalBoqItem {
  id: string;
  proposalId: string;
  groupLabel: string;
  description: string;
  qty: number;
  unit: string;
  sort: number;
}
