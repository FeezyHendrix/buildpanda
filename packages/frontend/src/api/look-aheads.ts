import api from "./client";
import type {
  AutoWindowResult,
  CreateLookAheadInput,
  LookAhead,
  LookAheadStatus,
  LookAheadTimeline,
  UpdateLookAheadInput,
} from "@/lib/project-types";

export interface LookAheadFilters {
  status?: LookAheadStatus;
  timeline?: LookAheadTimeline;
  buildingId?: string;
}

export const lookAheadsApi = {
  autoWindow: (projectId: string, weeks: number) =>
    api.get<AutoWindowResult>(`/projects/${projectId}/look-aheads/auto-window`, {
      params: { weeks },
    }).then((r) => r.data),

  list: (projectId: string, filters?: LookAheadFilters) =>
    api.get<LookAhead[]>(`/projects/${projectId}/look-aheads`, {
      params: filters,
    }).then((r) => r.data),

  create: (projectId: string, body: CreateLookAheadInput) =>
    api.post<LookAhead>(`/projects/${projectId}/look-aheads`, body).then((r) => r.data),

  update: (projectId: string, lookAheadId: string, body: UpdateLookAheadInput) =>
    api.patch<LookAhead>(`/projects/${projectId}/look-aheads/${lookAheadId}`, body).then((r) => r.data),

  delete: (projectId: string, lookAheadId: string) =>
    api.delete(`/projects/${projectId}/look-aheads/${lookAheadId}`).then((r) => r.data),
};
