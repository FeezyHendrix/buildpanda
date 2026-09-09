import { request } from "./client";

export const RFI_STATUSES = ["Draft", "Open", "InReview", "Answered", "Closed", "Void"] as const;
export type RfiStatus = (typeof RFI_STATUSES)[number];

export const RFI_PRIORITIES = ["Low", "Normal", "High"] as const;
export type RfiPriority = (typeof RFI_PRIORITIES)[number];

export const RFI_STATUS_TRANSITIONS = ["Closed", "Void", "Open"] as const;
export type RfiStatusTransition = (typeof RFI_STATUS_TRANSITIONS)[number];

export interface Rfi {
  id: string;
  number: number;
  subject: string;
  question: string;
  questionHtml: string | null;
  status: RfiStatus;
  priority: RfiPriority;
  ballInCourtName: string | null;
  dueDate: string | null;
  officialResponse: string | null;
  costImpact: boolean;
  scheduleImpact: boolean;
}

export interface RfiComment {
  id: string;
  rfiId: string;
  authorId: string;
  authorName: string;
  body: string;
  contentHtml: string | null;
  createdAt: string;
}

export interface RfiDetail extends Rfi {
  comments: RfiComment[];
}

export interface UpsertRfiInput {
  subject: string;
  question: string;
  questionHtml?: string | null;
  priority?: RfiPriority;
  dueDate?: string | null;
  costImpact?: boolean;
  scheduleImpact?: boolean;
}

export const rfisApi = {
  list: (projectId: string) => request<Rfi[]>(`/projects/${projectId}/rfis`),

  detail: (projectId: string, rfiId: string) =>
    request<RfiDetail>(`/projects/${projectId}/rfis/${rfiId}`),

  addComment: (projectId: string, rfiId: string, body: string, contentHtml?: string | null) =>
    request<RfiComment>(`/projects/${projectId}/rfis/${rfiId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body, contentHtml }),
    }),

  create: (projectId: string, body: UpsertRfiInput) =>
    request<Rfi>(`/projects/${projectId}/rfis`, { method: "POST", body: JSON.stringify(body) }),

  update: (projectId: string, rfiId: string, body: Partial<UpsertRfiInput>) =>
    request<Rfi>(`/projects/${projectId}/rfis/${rfiId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  transition: (projectId: string, rfiId: string, status: RfiStatusTransition) =>
    request<Rfi>(`/projects/${projectId}/rfis/${rfiId}/transition`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
};
