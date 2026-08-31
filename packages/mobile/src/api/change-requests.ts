import { request } from "./client";

export const CHANGE_STATUSES = ["Draft", "Submitted", "Approved", "Rejected"] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

export interface ChangeRequest {
  id: string;
  title: string;
  description: string | null;
  descriptionHtml: string | null;
  reason: string | null;
  status: ChangeStatus;
  costImpact: number;
  timeImpactDays: number;
  currency: string;
}

export interface UpsertChangeRequestInput {
  title: string;
  description?: string | null;
  descriptionHtml?: string | null;
  reason?: string | null;
  costImpact?: number;
  timeImpactDays?: number;
}

export interface ChangeRequestComment {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface ChangeRequestDetail extends ChangeRequest {
  comments: ChangeRequestComment[];
}

export const changeRequestsApi = {
  list: (projectId: string) =>
    request<ChangeRequest[]>(`/projects/${projectId}/change-requests`),

  detail: (projectId: string, changeId: string) =>
    request<ChangeRequestDetail>(`/projects/${projectId}/change-requests/${changeId}`),

  create: (projectId: string, body: UpsertChangeRequestInput) =>
    request<ChangeRequest>(`/projects/${projectId}/change-requests`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (projectId: string, changeId: string, body: Partial<UpsertChangeRequestInput>) =>
    request<ChangeRequest>(`/projects/${projectId}/change-requests/${changeId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  addComment: (projectId: string, changeId: string, body: string) =>
    request<ChangeRequestComment>(`/projects/${projectId}/change-requests/${changeId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
};
