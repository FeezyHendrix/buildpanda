import api from "./client";
import type {
  ActionComment,
  ActionItem,
  ActionItemDetail,
  ActionPriority,
  ActionStatus,
  RecurrenceUnit,
} from "@/lib/project-types";

export interface ActionItemInput {
  title: string;
  description?: string | null;
  descriptionHtml?: string | null;
  status?: ActionStatus;
  priority?: ActionPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  recurrenceUnit?: RecurrenceUnit | null;
  recurrenceInterval?: number | null;
  recurrenceUntil?: string | null;
}

export const actionItemsApi = {
  list: (projectId: string, args?: { status?: ActionStatus }) =>
    api.get<ActionItem[]>(`/projects/${projectId}/action-items`, { params: args }).then((r) => r.data),

  detail: (projectId: string, itemId: string) =>
    api.get<ActionItemDetail>(`/projects/${projectId}/action-items/${itemId}`).then((r) => r.data),

  create: (projectId: string, body: ActionItemInput) =>
    api.post<ActionItem>(`/projects/${projectId}/action-items`, body).then((r) => r.data),

  update: (projectId: string, itemId: string, body: Partial<ActionItemInput>) =>
    api.patch<ActionItem>(`/projects/${projectId}/action-items/${itemId}`, body).then((r) => r.data),

  delete: (projectId: string, itemId: string) =>
    api.delete(`/projects/${projectId}/action-items/${itemId}`).then((r) => r.data),

  addComment: (projectId: string, itemId: string, body: string) =>
    api.post<ActionComment>(`/projects/${projectId}/action-items/${itemId}/comments`, { body }).then((r) => r.data),
};
