import api from "./client";
import type { Selection, SelectionStatus } from "@/lib/project-types";

export interface SelectionOptionInput {
  name: string;
  description?: string | null;
  price?: number | null;
}

export interface SelectionCreateInput {
  title: string;
  description?: string | null;
  category?: string | null;
  allowanceAmount?: number | null;
  dueDate?: string | null;
  options?: SelectionOptionInput[];
}

export interface SelectionUpdateInput {
  title?: string;
  description?: string | null;
  category?: string | null;
  allowanceAmount?: number | null;
  dueDate?: string | null;
  status?: "open" | "cancelled";
  options?: SelectionOptionInput[];
}

export const selectionsApi = {
  list: (projectId: string, status?: SelectionStatus) =>
    api
      .get<Selection[]>(`/projects/${projectId}/selections`, {
        params: status ? { status } : undefined,
      })
      .then((r) => r.data),

  create: (projectId: string, body: SelectionCreateInput) =>
    api.post<Selection>(`/projects/${projectId}/selections`, body).then((r) => r.data),

  update: (projectId: string, selectionId: string, body: SelectionUpdateInput) =>
    api.patch<Selection>(`/projects/${projectId}/selections/${selectionId}`, body).then((r) => r.data),

  remove: (projectId: string, selectionId: string) =>
    api.delete(`/projects/${projectId}/selections/${selectionId}`).then((r) => r.data),

  decide: (projectId: string, selectionId: string, optionId: string) =>
    api.post<Selection>(`/projects/${projectId}/selections/${selectionId}/decide`, { optionId }).then((r) => r.data),

  createChangeRequest: (projectId: string, selectionId: string) =>
    api.post<Selection>(`/projects/${projectId}/selections/${selectionId}/create-change-request`).then((r) => r.data),
};
