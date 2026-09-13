import api from "./client";
import type {
  ChangeAction,
  ChangeComment,
  ChangeRequest,
  ChangeRequestDetail,
  ChangeStatus,
  ChangeType,
} from "@/lib/project-types";

/**
 * Editing the content of a change. Status never appears here — the ladder is
 * walked by the actions below, each of which is a decision with an actor, a
 * timestamp and (for a rejection) a reason.
 */
export interface ChangeRequestInput {
  title: string;
  description?: string | null;
  reason?: string | null;
  reasonHtml?: string | null;
  costImpact?: number;
  timeImpactDays?: number;
  currency?: "NGN" | "USD";
  assigneeId?: string | null;
  type?: ChangeType;
  stageId?: string | null;
  rfiId?: string | null;
  eotClaimId?: string | null;
}

/** Rejecting and resubmitting both carry a reason; approving and executing need none. */
export interface ChangeActionInput {
  reason?: string;
  costImpact?: number;
  timeImpactDays?: number;
}

/** Status counts for the cards on the Change orders page; `grossProfit` is null until costs are recorded. */
export interface ChangeRequestSummary {
  draft: number;
  submitted: number;
  approved: number;
  executed: number;
  rejected: number;
  grossProfit: number | null;
}

export interface ChangeRequestBudgetLink {
  budgetCategoryId: string;
  amount: number;
  committed?: boolean;
}

export const changeRequestsApi = {
  list: (projectId: string, status?: ChangeStatus) =>
    api
      .get<ChangeRequest[]>(`/projects/${projectId}/change-requests`, {
        params: status ? { status } : undefined,
      })
      .then((r) => r.data),

  detail: (projectId: string, changeId: string) =>
    api
      .get<ChangeRequestDetail>(`/projects/${projectId}/change-requests/${changeId}`)
      .then((r) => r.data),

  summary: (projectId: string) =>
    api
      .get<ChangeRequestSummary>(`/projects/${projectId}/change-requests/summary`)
      .then((r) => r.data),

  create: (projectId: string, body: ChangeRequestInput) =>
    api
      .post<ChangeRequest>(`/projects/${projectId}/change-requests`, body)
      .then((r) => r.data),

  update: (projectId: string, changeId: string, body: Partial<ChangeRequestInput>) =>
    api
      .patch<ChangeRequest>(`/projects/${projectId}/change-requests/${changeId}`, body)
      .then((r) => r.data),

  /** Submit / approve / reject / resubmit / execute — the only way the ladder moves. */
  action: (projectId: string, changeId: string, action: ChangeAction, body: ChangeActionInput = {}) =>
    api
      .post<ChangeRequestDetail>(
        `/projects/${projectId}/change-requests/${changeId}/${action}`,
        body,
      )
      .then((r) => r.data),

  remove: (projectId: string, changeId: string) =>
    api.delete(`/projects/${projectId}/change-requests/${changeId}`).then((r) => r.data),

  addComment: (
    projectId: string,
    changeId: string,
    body: { content: string; internalOnly?: boolean },
  ) =>
    api
      .post<ChangeComment>(`/projects/${projectId}/change-requests/${changeId}/comments`, body)
      .then((r) => r.data),

  listBudgetLinks: (projectId: string, changeId: string) =>
    api
      .get<{ links: ChangeRequestBudgetLink[] }>(
        `/projects/${projectId}/change-requests/${changeId}/budget-links`,
      )
      .then((r) => r.data.links),

  setBudgetLinks: (projectId: string, changeId: string, links: ChangeRequestBudgetLink[]) =>
    api
      .put<{ links: ChangeRequestBudgetLink[] }>(
        `/projects/${projectId}/change-requests/${changeId}/budget-links`,
        { links },
      )
      .then((r) => r.data.links),
};
