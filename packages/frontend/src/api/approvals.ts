import api from "./client";
import type {
  Approval,
  ApprovalComment,
  ApprovalDetail,
  ApprovalStatus,
} from "@/lib/project-types";

/** Files on a new request: up to 5 PNG/JPG/PDF, 10 MB each (docs/approval-request-form-backend.md §2). */
export const APPROVAL_ATTACHMENTS_ENABLED = true;

export interface ApprovalCreateInput {
  title: string;
  category?: string | null;
  description?: string | null;
  dueDate?: string | null;
  requestedReviewerId?: string | null;
  documentId?: string | null;
  documentVersionId?: string | null;
  sourceMarkupId?: string | null;
  /** Uploaded file ids (see APPROVAL_ATTACHMENTS_ENABLED). */
  attachments?: { fileId: string }[];
}
export interface ApprovalUpdateInput {
  title?: string;
  category?: string | null;
  description?: string | null;
  status?: ApprovalStatus;
  response?: string | null;
  responseHtml?: string | null;
  dueDate?: string | null;
  requestedReviewerId?: string | null;
}

export const approvalsApi = {
  list: (projectId: string, args?: { status?: ApprovalStatus }) =>
    api.get<Approval[]>(`/projects/${projectId}/approvals`, { params: args }).then((r) => r.data),

  detail: (projectId: string, approvalId: string) =>
    api.get<ApprovalDetail>(`/projects/${projectId}/approvals/${approvalId}`).then((r) => r.data),

  create: (projectId: string, body: ApprovalCreateInput) =>
    api.post<Approval>(`/projects/${projectId}/approvals`, body).then((r) => r.data),

  update: (projectId: string, approvalId: string, body: ApprovalUpdateInput) =>
    api.patch<Approval>(`/projects/${projectId}/approvals/${approvalId}`, body).then((r) => r.data),

  delete: (projectId: string, approvalId: string) =>
    api.delete(`/projects/${projectId}/approvals/${approvalId}`).then((r) => r.data),

  addComment: (projectId: string, approvalId: string, body: string) =>
    api.post<ApprovalComment>(`/projects/${projectId}/approvals/${approvalId}/comments`, { body }).then((r) => r.data),
};
