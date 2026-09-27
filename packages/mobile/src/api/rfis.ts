import { request } from "./client";

export const RFI_STATUSES = ["Draft", "Open", "InReview", "Answered", "Closed", "Void"] as const;
export type RfiStatus = (typeof RFI_STATUSES)[number];

/** Display names, mirroring the web's RFI_STATUS_META so "InReview" never reaches a screen. */
export const RFI_STATUS_LABELS: Record<RfiStatus, string> = {
  Draft: "Draft",
  Open: "Open",
  InReview: "In review",
  Answered: "Answered",
  Closed: "Closed",
  Void: "Void",
};

export const RFI_PRIORITIES = ["Low", "Normal", "High"] as const;
export type RfiPriority = (typeof RFI_PRIORITIES)[number];

export const RFI_STATUS_TRANSITIONS = ["Closed", "Void", "Open"] as const;
export type RfiStatusTransition = (typeof RFI_STATUS_TRANSITIONS)[number];

/** Statuses the server accepts an official response on: anything not yet closed or voided. */
export const RFI_RESPONDABLE_STATUSES: readonly RfiStatus[] = ["Open", "InReview", "Answered"];

/** Statuses the server lets a manager reopen from (`REOPENABLE` in the backend service). */
export const RFI_REOPENABLE_STATUSES: readonly RfiStatus[] = ["Answered", "Closed"];

export interface Rfi {
  id: string;
  number: number;
  subject: string;
  question: string;
  questionHtml: string | null;
  status: RfiStatus;
  priority: RfiPriority;
  ballInCourtId: string | null;
  ballInCourtName: string | null;
  dueDate: string | null;
  officialResponse: string | null;
  officialRespondedByName: string | null;
  officialRespondedAt: string | null;
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

/** Mirrors the backend's createBody / updateBody (`rfis/routes.ts`). */
export interface UpsertRfiInput {
  subject: string;
  question: string;
  questionHtml?: string | null;
  priority?: RfiPriority;
  ballInCourtId?: string | null;
  ballInCourtName?: string | null;
  dueDate?: string | null;
  costImpact?: boolean;
  scheduleImpact?: boolean;
  /** Only accepted on create: the sheet, revision and pin an RFI was raised from. */
  documentId?: string | null;
  documentVersionId?: string | null;
  sourceMarkupId?: string | null;
}

export interface RespondRfiInput {
  body: string;
  contentHtml?: string | null;
  /** True posts the official answer (server moves the RFI to Answered); false proposes one. */
  official: boolean;
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

  /** Posts a response through the respond endpoint; returns the whole RFI with its thread. */
  respond: (projectId: string, rfiId: string, input: RespondRfiInput) =>
    request<RfiDetail>(`/projects/${projectId}/rfis/${rfiId}/respond`, {
      method: "POST",
      body: JSON.stringify({
        body: input.body,
        contentHtml: input.contentHtml ?? null,
        official: input.official,
      }),
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
