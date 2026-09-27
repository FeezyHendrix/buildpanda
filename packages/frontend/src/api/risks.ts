import api from "./client";
import type { RiskFactor, RiskLevel, RiskStatus } from "@/lib/project-types";

export interface RiskFields {
  title: string;
  description: string;
  descriptionHtml?: string | null;
  severity: RiskLevel;
  status?: RiskStatus;
  ownerId?: string | null;
  ownerName?: string | null;
  mitigation?: string | null;
  reviewDate?: string | null;
  linkedActivityId?: string | null;
}

export interface CreateRiskVariables extends RiskFields {
  projectId: string;
}

export interface EditRiskVariables extends Partial<RiskFields> {
  projectId: string;
  riskId: string;
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
