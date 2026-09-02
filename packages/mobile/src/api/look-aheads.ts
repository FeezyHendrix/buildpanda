import { request } from "./client";

export const LOOK_AHEAD_STATUSES = ["Draft", "UnderReview", "Approved"] as const;
export type LookAheadStatus = (typeof LOOK_AHEAD_STATUSES)[number];

export interface LookAhead {
  id: string;
  name: string;
  description: string | null;
  status: LookAheadStatus;
  startDate: string;
  endDate: string;
  totalWorkers: number | null;
}

export interface CreateLookAheadInput {
  name: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  totalWorkers?: number | null;
  // Required by the API on a multi-building project; the server resolves it
  // when the project has a single building.
  buildingId?: string | null;
}

export type UpdateLookAheadInput = Partial<CreateLookAheadInput>;

export const lookAheadsApi = {
  list: (projectId: string) => request<LookAhead[]>(`/projects/${projectId}/look-aheads`),

  detail: (projectId: string, lookAheadId: string) =>
    request<LookAhead>(`/projects/${projectId}/look-aheads/${lookAheadId}`),

  create: (projectId: string, body: CreateLookAheadInput) =>
    request<LookAhead>(`/projects/${projectId}/look-aheads`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (projectId: string, lookAheadId: string, body: Partial<CreateLookAheadInput>) =>
    request<LookAhead>(`/projects/${projectId}/look-aheads/${lookAheadId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  remove: (projectId: string, lookAheadId: string) =>
    request<{ ok: boolean }>(`/projects/${projectId}/look-aheads/${lookAheadId}`, {
      method: "DELETE",
    }),
};
