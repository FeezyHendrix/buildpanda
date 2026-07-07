import api from "./client";
import type { RiskFactor, RiskLevel } from "@/lib/project-types";

export interface CreateRiskVariables {
  projectId: string;
  title: string;
  description: string;
  descriptionHtml?: string | null;
  severity: RiskLevel;
}

export interface EditRiskVariables {
  projectId: string;
  riskId: string;
  title?: string;
  description?: string;
  descriptionHtml?: string | null;
  severity?: RiskLevel;
}

export interface DeleteRiskVariables {
  projectId: string;
  riskId: string;
}

export const risksApi = {
  list: (projectId: string) =>
    api.get<RiskFactor[]>(`/projects/${projectId}/risk-factors`).then((r) => r.data),

  create: (projectId: string, body: Omit<CreateRiskVariables, "projectId">) =>
    api.post<RiskFactor>(`/projects/${projectId}/risk-factors`, body).then((r) => r.data),

  update: (projectId: string, riskId: string, body: Omit<EditRiskVariables, "projectId" | "riskId">) =>
    api.put<RiskFactor>(`/projects/${projectId}/risk-factors/${riskId}`, body).then((r) => r.data),

  remove: (projectId: string, riskId: string) =>
    api.delete(`/projects/${projectId}/risk-factors/${riskId}`).then((r) => r.data),
};
