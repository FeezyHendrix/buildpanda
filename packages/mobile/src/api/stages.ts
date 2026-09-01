import { request } from "./client";

export interface Stage {
  id: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  dateRange: string | null;
  progressPercent: number;
  sortOrder: number;
}

export const stagesApi = {
  list: (projectId: string) => request<Stage[]>(`/projects/${projectId}/stages`),

  update: (projectId: string, stageId: string, patch: { status?: string; buildingId?: string | null }) =>
    request<Stage>(`/projects/${projectId}/stages/${stageId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
};
