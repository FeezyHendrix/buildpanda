import api from "./client";
import type { KeyDate, KeyDateStatus } from "@/lib/project-types";

export interface KeyDateInput {
  label: string;
  targetDate?: string | null;
  actualDate?: string | null;
  status?: KeyDateStatus;
  notes?: string | null;
}

export const keyDatesApi = {
  list: (projectId: string, buildingId?: string) =>
    api
      .get<KeyDate[]>(`/projects/${projectId}/key-dates`, {
        params: buildingId ? { buildingId } : undefined,
      })
      .then((r) => r.data),

  create: (projectId: string, body: KeyDateInput) =>
    api.post<KeyDate>(`/projects/${projectId}/key-dates`, body).then((r) => r.data),

  update: (projectId: string, keyDateId: string, body: Partial<KeyDateInput>) =>
    api.patch<KeyDate>(`/projects/${projectId}/key-dates/${keyDateId}`, body).then((r) => r.data),

  delete: (projectId: string, keyDateId: string) =>
    api.delete(`/projects/${projectId}/key-dates/${keyDateId}`).then((r) => r.data),
};
