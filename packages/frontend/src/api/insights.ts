import api from "./client";
import type { ProjectInsights, WhatsNext, GlobalWhatsNext } from "@/lib/project-types";

export const insightsApi = {
  getInsights: (projectId: string) =>
    api.get<ProjectInsights>(`/projects/${projectId}/insights`).then((r) => r.data),

  getGlobalWhatsNext: (days: number) =>
    api.get<GlobalWhatsNext>("/whats-next", { params: { days } }).then((r) => r.data),

  getWhatsNext: (projectId: string, days: number) =>
    api.get<WhatsNext>(`/projects/${projectId}/whats-next`, { params: { days } }).then((r) => r.data),
};
