import api from "./client";
import type {
  QueryStatus,
  SiteQuery,
  SiteQueryComment,
  SiteQueryDetail,
} from "@/lib/project-types";

export interface QueryCreateInput {
  subject: string;
  question: string;
  questionHtml?: string | null;
  dueDate?: string | null;
  assigneeId?: string | null;
}

export interface QueryUpdateInput {
  subject?: string;
  question?: string;
  questionHtml?: string | null;
  status?: QueryStatus;
  answer?: string | null;
  answerHtml?: string | null;
  dueDate?: string | null;
  assigneeId?: string | null;
}

export const queriesApi = {
  list: (projectId: string, status?: QueryStatus) =>
    api.get<SiteQuery[]>(`/projects/${projectId}/queries`, {
      params: status ? { status } : undefined,
    }).then((r) => r.data),

  get: (projectId: string, queryId: string) =>
    api.get<SiteQueryDetail>(`/projects/${projectId}/queries/${queryId}`).then((r) => r.data),

  create: (projectId: string, body: QueryCreateInput) =>
    api.post<SiteQuery>(`/projects/${projectId}/queries`, body).then((r) => r.data),

  update: (projectId: string, queryId: string, body: QueryUpdateInput) =>
    api.patch<SiteQuery>(`/projects/${projectId}/queries/${queryId}`, body).then((r) => r.data),

  delete: (projectId: string, queryId: string) =>
    api.delete(`/projects/${projectId}/queries/${queryId}`).then((r) => r.data),

  addComment: (projectId: string, queryId: string, body: { body: string }) =>
    api.post<SiteQueryComment>(`/projects/${projectId}/queries/${queryId}/comments`, body).then((r) => r.data),
};
