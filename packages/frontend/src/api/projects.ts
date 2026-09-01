import api from "./client";
import type { AiUpdateCadence, Currency, Project } from "@/lib/project-types";

export interface ProjectTemplateSummary {
  id: string;
  name: string;
  description: string;
  stageCount: number;
  taskCount: number;
  totalWeeks: number;
  stages: Array<{ name: string; durationWeeks: number; dateRange: string }>;
}

export interface CreateProjectInput {
  title: string;
  projectType: string;
  templateId?: string;
  location: {
    state: string;
    city: string;
    ownsLand: boolean;
  };
  details: {
    buildingType: string;
    currency: Currency;
    budgetMin: number;
    budgetMax: number;
    timeline: string;
    fundingMethod: string;
  };
  management: {
    involvementLevel: string;
    riskOptions: string[];
  };
}

export interface UpdateProjectBudgetInput {
  budgetMin: number;
  budgetMax: number;
  currency?: Currency;
}

export const projectsApi = {
  list: () => api.get<Project[]>("/projects").then((r) => r.data),
  
  detail: (id: string) => api.get<Project>(`/projects/${id}`).then((r) => r.data),
  
  templates: () => api.get<ProjectTemplateSummary[]>("/project-templates").then((r) => r.data),
  
  create: (input: CreateProjectInput) => api.post<Project>("/projects", input).then((r) => r.data),
  
  delete: (id: string) => api.delete(`/projects/${id}`).then((r) => r.data),
  
  updateBudget: (id: string, input: UpdateProjectBudgetInput) => api.patch<Project>(`/projects/${id}/budget`, input).then((r) => r.data),

  updateCurrency: (id: string, currency: string) => api.patch<Project>(`/projects/${id}/currency`, { currency }).then((r) => r.data),

  settings: (id: string) => api.get<ProjectSettings>(`/projects/${id}/settings`).then((r) => r.data),

  updateSettings: (id: string, input: ProjectSettings) => api.put<ProjectSettings>(`/projects/${id}/settings`, input).then((r) => r.data),
};

export interface ProjectSettings {
  aiUpdateCadence: AiUpdateCadence;
}
