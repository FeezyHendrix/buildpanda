import { request } from "./client";

export interface KeyDate {
  id: string;
  label: string;
  targetDate: string | null;
  actualDate: string | null;
  status: string;
  notes: string | null;
  sortOrder: number;
}

export const keyDatesApi = {
  list: (projectId: string) => request<KeyDate[]>(`/projects/${projectId}/key-dates`),
};
