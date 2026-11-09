import { request } from "./client";

export const CHANGE_STATUSES = ["Draft", "Submitted", "Approved", "Rejected"] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

/** Display names — mirrors the web dialog's STATUS list so both apps read the same. */
export const CHANGE_STATUS_LABELS: Record<ChangeStatus, string> = {
  Draft: "Draft",
  Submitted: "Submitted",
  Approved: "Approved",
  Rejected: "Rejected",
};

export const CHANGE_CURRENCIES = ["NGN", "USD"] as const;
export type ChangeCurrency = (typeof CHANGE_CURRENCIES)[number];

export function changeStatus(value: string): ChangeStatus {
  return (CHANGE_STATUSES as readonly string[]).includes(value) ? (value as ChangeStatus) : "Draft";
}

export function changeCurrency(value: string): ChangeCurrency {
  return (CHANGE_CURRENCIES as readonly string[]).includes(value) ? (value as ChangeCurrency) : "NGN";
}

export interface ChangeRequest {
  id: string;
  title: string;
  description: string | null;
  descriptionHtml: string | null;
  reason: string | null;
  status: ChangeStatus;
  costImpact: number;
  timeImpactDays: number;
  currency: ChangeCurrency;
}

/**
 * Create accepts everything but `status` (a new request is always a Draft on
 * the server); update accepts all of it. The outbox sends `status` only on
 * PATCH for that reason.
 */
export interface UpsertChangeRequestInput {
  title: string;
  description?: string | null;
  descriptionHtml?: string | null;
  reason?: string | null;
  reasonHtml?: string | null;
  status?: ChangeStatus;
  assigneeId?: string | null;
  costImpact?: number;
  timeImpactDays?: number;
  currency?: ChangeCurrency;
}

export interface ChangeRequestComment {
  id: string;
  changeRequestId: string;
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

  create: (projectId: string, body: Omit<UpsertChangeRequestInput, "status">) =>
    request<ChangeRequest>(`/projects/${projectId}/change-requests`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (projectId: string, changeId: string, body: Partial<UpsertChangeRequestInput>) =>
    request<ChangeRequest>(`/projects/${projectId}/change-requests/${changeId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  remove: (projectId: string, changeId: string) =>
    request<{ ok: boolean }>(`/projects/${projectId}/change-requests/${changeId}`, {
      method: "DELETE",
    }),

  addComment: (projectId: string, changeId: string, body: string) =>
    request<ChangeRequestComment>(`/projects/${projectId}/change-requests/${changeId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
};
