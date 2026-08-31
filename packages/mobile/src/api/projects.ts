import { request } from "./client";

export interface Project {
  id: string;
  name: string;
  address: string;
  status: string;
  progressPercent: number;
}

export interface ProjectSettings {
  aiUpdatesEnabled: boolean;
}

export const projectsApi = {
  list: () => request<Project[]>("/projects"),

  detail: (id: string) => request<Project>(`/projects/${id}`),

  settings: (id: string) => request<ProjectSettings>(`/projects/${id}/settings`),

  updateSettings: (id: string, body: ProjectSettings) =>
    request<ProjectSettings>(`/projects/${id}/settings`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};
