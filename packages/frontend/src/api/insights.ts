import api from "./client";
import type { ProjectInsights } from "@/lib/project-types";

export const insightsApi = {
  getInsights: (projectId: string) =>
    api.get<ProjectInsights>(`/projects/${projectId}/insights`).then((r) => r.data),
};
