import { request } from "./client";

export interface Project {
  id: string;
  name: string;
  address: string;
  status: string;
  progressPercent: number;
  /** ISO code expenses and costs are recorded in, e.g. NGN. */
  currency?: string;
}

export const projectsApi = {
  list: () => request<Project[]>("/projects"),

  detail: (id: string) => request<Project>(`/projects/${id}`),
};
