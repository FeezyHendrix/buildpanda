import api from "./client";
import type { Rfi, RfiDetail, RfiEvent, RfiPriority, RfiStatus } from "@/lib/project-types";

export interface RfiCreateInput {
  subject: string;
  question: string;
  questionHtml?: string | null;
  priority?: RfiPriority;
  dueDate?: string | null;
  costImpact?: boolean;
  scheduleImpact?: boolean;
  ballInCourtId?: string | null;
  ballInCourtName?: string | null;
  ballInCourtEmail?: string | null;
  documentId?: string | null;
  documentVersionId?: string | null;
  sourceMarkupId?: string | null;
}

export interface RfiUpdateInput {
  subject?: string;
  question?: string;
  questionHtml?: string | null;
  priority?: RfiPriority;
  dueDate?: string | null;
  costImpact?: boolean;
  scheduleImpact?: boolean;
  ballInCourtId?: string | null;
  ballInCourtName?: string | null;
  ballInCourtEmail?: string | null;
  assigneeRole?: string | null;
}

export interface RfiRespondInput {
  body: string;
  official?: boolean;
  contentHtml?: string | null;
  attachments?: { fileId: string; url: string; name: string }[];
  references?: { type: "action_item" | "activity"; id: string; label: string }[];
}

export const rfisApi = {
  list: (projectId: string, status?: RfiStatus) =>
    api
      .get<Rfi[]>(`/projects/${projectId}/rfis`, {
        params: status ? { status } : undefined,
      })
      .then((r) => r.data),

  detail: (projectId: string, rfiId: string) =>
    api.get<RfiDetail>(`/projects/${projectId}/rfis/${rfiId}`).then((r) => r.data),

  create: (projectId: string, body: RfiCreateInput) =>
    api.post<Rfi>(`/projects/${projectId}/rfis`, body).then((r) => r.data),

  update: (projectId: string, rfiId: string, body: RfiUpdateInput) =>
    api.patch<Rfi>(`/projects/${projectId}/rfis/${rfiId}`, body).then((r) => r.data),

  respond: (projectId: string, rfiId: string, body: RfiRespondInput) =>
    api.post<RfiDetail>(`/projects/${projectId}/rfis/${rfiId}/respond`, body).then((r) => r.data),

  transition: (projectId: string, rfiId: string, status: "Closed" | "Void" | "Open") =>
    api.post<Rfi>(`/projects/${projectId}/rfis/${rfiId}/transition`, { status }).then((r) => r.data),

  comment: (projectId: string, rfiId: string, body: string) =>
    api.post(`/projects/${projectId}/rfis/${rfiId}/comments`, { body }).then((r) => r.data),

  events: (projectId: string, rfiId: string) =>
    api.get<RfiEvent[]>(`/projects/${projectId}/rfis/${rfiId}/events`).then((r) => r.data),

  /** `changeRequestId` links an existing change request instead of raising a new one. */
  convertToChange: (projectId: string, rfiId: string, changeRequestId?: string | null) =>
    api
      .post<Rfi>(`/projects/${projectId}/rfis/${rfiId}/convert-to-change`, {
        changeRequestId: changeRequestId ?? null,
      })
      .then((r) => r.data),
};
