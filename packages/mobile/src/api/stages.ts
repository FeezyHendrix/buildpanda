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
};
