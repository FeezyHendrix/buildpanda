import api from "./client";
import type {
  MediaType,
  ProjectUpdate,
  UpdateCategory,
  UpdateComment,
  UpdateStatus,
} from "@/lib/project-types";

export interface UpdateMediaInput {
  type: MediaType;
  url: string;
}

export interface CreateUpdateInput {
  category: UpdateCategory;
  title: string;
  description: string;
  media: UpdateMediaInput[];
}

export interface EditUpdateInput {
  category?: UpdateCategory;
  title?: string;
  description?: string;
  media?: UpdateMediaInput[];
}

export const updatesApi = {
  list: (projectId: string) =>
    api.get<ProjectUpdate[]>(`/projects/${projectId}/updates`).then((r) => r.data),

  getComments: (projectId: string, updateId: string) =>
    api.get<UpdateComment[]>(`/projects/${projectId}/updates/${updateId}/comments`).then((r) => r.data),

  transition: (projectId: string, updateId: string, status: Exclude<UpdateStatus, "Open">) =>
    api.patch<ProjectUpdate>(`/projects/${projectId}/updates/${updateId}`, { status }).then((r) => r.data),

  addComment: (projectId: string, updateId: string, body: string) =>
    api.post<UpdateComment>(`/projects/${projectId}/updates/${updateId}/comments`, { body }).then((r) => r.data),

  create: (projectId: string, body: CreateUpdateInput) =>
    api.post<ProjectUpdate>(`/projects/${projectId}/updates`, body).then((r) => r.data),

  edit: (projectId: string, updateId: string, patch: EditUpdateInput) =>
    api.put<ProjectUpdate>(`/projects/${projectId}/updates/${updateId}`, patch).then((r) => r.data),

  generateAiDraft: (projectId: string) =>
    api.post<ProjectUpdate>(`/projects/${projectId}/updates/ai-draft`).then((r) => r.data),

  generateDailyDigest: (projectId: string, date?: string) =>
    api
      .post<ProjectUpdate>(`/projects/${projectId}/updates/daily-digest`, undefined, {
        params: date ? { date } : undefined,
      })
      .then((r) => r.data),

  publish: (projectId: string, updateId: string) =>
    api.post<ProjectUpdate>(`/projects/${projectId}/updates/${updateId}/publish`).then((r) => r.data),

  delete: (projectId: string, updateId: string) =>
    api.delete(`/projects/${projectId}/updates/${updateId}`).then((r) => r.data),
};
