import api from "./client";
import type {
  ChangeComment,
  ChangeRequest,
  ChangeRequestDetail,
  ChangeStatus,
} from "@/lib/project-types";

export interface ChangeRequestInput {
  title: string;
  description?: string | null;
  reason?: string | null;
  status?: ChangeStatus;
  costImpact?: number;
  timeImpactDays?: number;
  currency?: "NGN" | "USD";
  assigneeId?: string | null;
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

  create: (projectId: string, body: ChangeRequestInput) =>
    api
      .post<ChangeRequest>(`/projects/${projectId}/change-requests`, body)
      .then((r) => r.data),

  update: (projectId: string, changeId: string, body: Partial<ChangeRequestInput>) =>
    api
      .patch<ChangeRequest>(`/projects/${projectId}/change-requests/${changeId}`, body)
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
