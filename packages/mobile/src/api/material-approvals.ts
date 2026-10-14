import { request } from "./client";
import type { ApprovalStatus, MaterialApproval, MaterialApprovalDetail, MaterialApprovalCreateInput, MaterialApprovalUpdateInput, ApprovalComment } from "./material-approval-types";
export * from "./material-approval-types";

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
