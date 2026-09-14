import { request } from "./client";

export const LOOK_AHEAD_STATUSES = ["Draft", "UnderReview", "Approved"] as const;
export type LookAheadStatus = (typeof LOOK_AHEAD_STATUSES)[number];

/** An activity assigned into the window, as the server summarises it. */
export interface LookAheadActivitySummary {
  activityId: string;
  name: string;
  status: string;
  plannedStartAt: string;
  plannedEndAt: string;
  workerCountPlanned: number;
}

export interface LookAhead {
  id: string;
  name: string;
  description: string | null;
  status: LookAheadStatus;
  startDate: string;
  endDate: string;
  totalWorkers: number | null;
  activities: LookAheadActivitySummary[];
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
  /** Activities assigned into the window at creation. */
  activityIds?: string[];
}

/** The PATCH body: activities are assigned and unassigned as deltas, not replaced. */
export interface UpdateLookAheadInput
  extends Partial<Omit<CreateLookAheadInput, "buildingId" | "activityIds">> {
  assignActivityIds?: string[];
  unassignActivityIds?: string[];
}

export const lookAheadsApi = {
  list: (projectId: string) => request<LookAhead[]>(`/projects/${projectId}/look-aheads`),

  create: (projectId: string, body: CreateLookAheadInput) =>
    request<LookAhead>(`/projects/${projectId}/look-aheads`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (projectId: string, lookAheadId: string, body: UpdateLookAheadInput) =>
    request<LookAhead>(`/projects/${projectId}/look-aheads/${lookAheadId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  remove: (projectId: string, lookAheadId: string) =>
    request<{ ok: boolean }>(`/projects/${projectId}/look-aheads/${lookAheadId}`, {
      method: "DELETE",
    }),
};
