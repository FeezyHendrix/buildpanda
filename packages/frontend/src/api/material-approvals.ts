import api from "./client";
import type { ApprovalComment, ApprovalStatus } from "@/lib/project-types";

/**
 * A material approval request is a standalone contractual record: somebody on
 * site asks for a named material/spec to be signed off before it is ordered or
 * installed. It shares the approvals lifecycle (Pending -> Approved / Rejected /
 * Resubmit) but carries its own material detail, and lives on its own
 * `/material-approvals` routes so the client sign-off workflow stays separate.
 */
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
  dueDate?: string | null;
  requestedReviewerId?: string | null;
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
  list: (projectId: string, args?: { status?: ApprovalStatus }) =>
    api
      .get<MaterialApproval[]>(`/projects/${projectId}/material-approvals`, { params: args })
      .then((r) => r.data),

  detail: (projectId: string, approvalId: string) =>
    api
      .get<MaterialApprovalDetail>(`/projects/${projectId}/material-approvals/${approvalId}`)
      .then((r) => r.data),

  create: (projectId: string, body: MaterialApprovalCreateInput) =>
    api
      .post<MaterialApproval>(`/projects/${projectId}/material-approvals`, body)
      .then((r) => r.data),

  update: (projectId: string, approvalId: string, body: MaterialApprovalUpdateInput) =>
    api
      .patch<MaterialApproval>(`/projects/${projectId}/material-approvals/${approvalId}`, body)
      .then((r) => r.data),

  delete: (projectId: string, approvalId: string) =>
    api.delete(`/projects/${projectId}/material-approvals/${approvalId}`).then((r) => r.data),

  addComment: (projectId: string, approvalId: string, body: string) =>
    api
      .post<ApprovalComment>(`/projects/${projectId}/material-approvals/${approvalId}/comments`, {
        body,
      })
      .then((r) => r.data),
};
