import { request } from "./client";

/**
 * A material approval request is a standalone contractual record: site asks for
 * a named material and specification to be signed off before it is ordered or
 * installed. It shares the approvals lifecycle (Pending -> Approved / Rejected
 * / Resubmit) but carries its own material detail and lives on its own
 * `/material-approvals` routes, mirroring packages/frontend/src/api/material-approvals.ts.
 */
export const MATERIAL_APPROVAL_STATUSES = [
  "Pending",
  "Approved",
  "Rejected",
  "Resubmit",
] as const;
export type ApprovalStatus = (typeof MATERIAL_APPROVAL_STATUSES)[number];

/** The boundary where a status read back out of SQLite re-enters the union. */
export function isApprovalStatus(value: string): value is ApprovalStatus {
  return (MATERIAL_APPROVAL_STATUSES as readonly string[]).includes(value);
}

/** Units the web upsert form offers, kept identical so the two clients agree. */
export const MATERIAL_UNITS = [
  "ea",
  "m",
  "m2",
  "m3",
  "kg",
  "tonne",
  "bag",
  "roll",
  "litre",
  "set",
] as const;
export type MaterialUnit = (typeof MATERIAL_UNITS)[number];

export interface ApprovalComment {
  id: string;
  approvalId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface MaterialApproval {
  id: string;
  projectId: string;
  kind: "material";
  title: string;
  category: string | null;
  description: string | null;
  descriptionHtml: string | null;
  status: ApprovalStatus;
  response: string | null;
  responseHtml: string | null;
  dueDate: string | null;
  submittedById: string | null;
  requestedReviewerId: string | null;
  requestedReviewerName: string | null;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  materialName: string;
  specification: string | null;
  quantity: number;
  unit: string;
  supplier: string | null;
  neededBy: string | null;
  phaseId: string | null;
  phaseName: string | null;
  activityId: string | null;
  activityName: string | null;
}

export interface MaterialApprovalDetail extends MaterialApproval {
  comments: ApprovalComment[];
}

export interface MaterialApprovalCreateInput {
  title: string;
  materialName: string;
  specification?: string | null;
  quantity?: number;
  unit?: string;
  supplier?: string | null;
  neededBy?: string | null;
  phaseId?: string | null;
  activityId?: string | null;
  description?: string | null;
  descriptionHtml?: string | null;
  dueDate?: string | null;
  requestedReviewerId?: string | null;
  /**
   * Create-only: the sheet and revision a request was raised from. The
   * material route does not accept `sourceMarkupId` (unlike `/approvals` and
   * `/rfis`), so the pin is kept locally and never sent.
   */
  documentId?: string | null;
  documentVersionId?: string | null;
}

export interface MaterialApprovalUpdateInput {
  title?: string;
  materialName?: string;
  specification?: string | null;
  quantity?: number;
  unit?: string;
  supplier?: string | null;
  neededBy?: string | null;
  phaseId?: string | null;
  activityId?: string | null;
  description?: string | null;
  status?: ApprovalStatus;
  response?: string | null;
  dueDate?: string | null;
  requestedReviewerId?: string | null;
}

export const materialApprovalsApi = {
  list: (projectId: string, status?: ApprovalStatus) =>
    request<MaterialApproval[]>(
      `/projects/${projectId}/material-approvals${status ? `?status=${status}` : ""}`,
    ),

  detail: (projectId: string, approvalId: string) =>
    request<MaterialApprovalDetail>(`/projects/${projectId}/material-approvals/${approvalId}`),

  create: (projectId: string, body: MaterialApprovalCreateInput) =>
    request<MaterialApproval>(`/projects/${projectId}/material-approvals`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (projectId: string, approvalId: string, body: MaterialApprovalUpdateInput) =>
    request<MaterialApproval>(`/projects/${projectId}/material-approvals/${approvalId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  /** Server rule: only a request still `Pending` can be removed. */
  remove: (projectId: string, approvalId: string) =>
    request<void>(`/projects/${projectId}/material-approvals/${approvalId}`, {
      method: "DELETE",
    }),

  addComment: (projectId: string, approvalId: string, body: string) =>
    request<ApprovalComment>(
      `/projects/${projectId}/material-approvals/${approvalId}/comments`,
      { method: "POST", body: JSON.stringify({ body }) },
    ),
};
