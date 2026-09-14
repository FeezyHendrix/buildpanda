import api from "./client";
import type {
  Activity,
  ActivityDelay,
  ActivityDependency,
  ActivityEvent,
  ActivityStatus,
  Culpability,
  Currency,
} from "@/lib/project-types";

export interface CreateActivityInput {
  projectId: string;
  name: string;
  activityType: string;
  phaseId?: string | null;
  location?: string;
  plannedStartAt: string;
  plannedEndAt: string;
  workerCountPlanned?: number;
  assigneeId?: string | null;
  notes?: string;
  predecessors?: ActivityDependency[];
  percentComplete?: number;
  isMilestone?: boolean;
}
export interface UpdateActivityInput {
  projectId: string;
  activityId: string;
  name?: string;
  activityType?: string;
  phaseId?: string | null;
  location?: string | null;
  status?: ActivityStatus;
  plannedStartAt?: string;
  plannedEndAt?: string;
  actualStartAt?: string | null;
  actualEndAt?: string | null;
  workerCountPlanned?: number;
  assigneeId?: string | null;
  notes?: string | null;
  predecessors?: ActivityDependency[];
  percentComplete?: number;
  isMilestone?: boolean;
}
export interface DeleteActivityInput {
  projectId: string;
  activityId: string;
}

/** The attribution and links a delay carries, shared by raising and amending one. */
export interface DelayAttribution {
  endedAt?: string | null;
  daysLost?: number;
  culpability?: Culpability;
  eotClaimable?: boolean;
  linkedRfiId?: string | null;
  linkedChangeRequestId?: string | null;
  linkedMaterialOrderId?: string | null;
  preventionNotes?: string;
}

export interface RaiseDelayInput extends DelayAttribution {
  projectId: string;
  activityId: string;
  reasonCode: string;
  description?: string;
  startedAt: string;
  costImpact?: number;
  currency?: Currency;
}

/**
 * `PATCH …/delays/:delayId` is both "resolve" and "amend": setting `endedAt`
 * closes the delay, and changing `daysLost` re-applies the cascade by the delta.
 */
export interface ResolveDelayInput extends DelayAttribution {
  projectId: string;
  activityId: string;
  delayId: string;
  resolvedAt?: string;
}

/**
 * "Location (optional)" left blank used to send `""`, which the schema rejects
 * with `must NOT have fewer than 1 characters` (finding #42). Absent means
 * absent; on an update it is cleared with an explicit null.
 */
function withoutBlankLocation<T extends { location?: string | null }>(body: T): T {
  if (body.location !== "") return body;
  const { location: _blank, ...rest } = body;
  return rest as T;
}

export const activitiesApi = {
  list: (projectId: string, buildingId?: string) =>
    api
      .get<Activity[]>(`/projects/${projectId}/activities`, {
        params: buildingId ? { buildingId } : undefined,
      })
      .then((r) => r.data),

  detail: (projectId: string, activityId: string) =>
    api.get<Activity>(`/projects/${projectId}/activities/${activityId}`).then((r) => r.data),

  create: (projectId: string, body: Omit<CreateActivityInput, "projectId">) =>
    api.post<Activity>(`/projects/${projectId}/activities`, withoutBlankLocation(body)).then((r) => r.data),

  update: (projectId: string, activityId: string, body: Omit<UpdateActivityInput, "projectId" | "activityId">) =>
    api
      .patch<Activity>(`/projects/${projectId}/activities/${activityId}`, withoutBlankLocation(body))
      .then((r) => r.data),

  delete: (projectId: string, activityId: string) =>
    api.delete(`/projects/${projectId}/activities/${activityId}`).then((r) => r.data),

  listDelays: (projectId: string, activityId: string) =>
    api
      .get<ActivityDelay[]>(`/projects/${projectId}/activities/${activityId}/delays`)
      .then((r) => r.data),

  listEvents: (projectId: string, activityId: string) =>
    api
      .get<ActivityEvent[]>(`/projects/${projectId}/activities/${activityId}/events`)
      .then((r) => r.data),

  raiseDelay: (projectId: string, activityId: string, body: Omit<RaiseDelayInput, "projectId" | "activityId">) =>
    api.post<ActivityDelay>(`/projects/${projectId}/activities/${activityId}/delays`, body).then((r) => r.data),

  resolveDelay: (projectId: string, activityId: string, delayId: string, body: Omit<ResolveDelayInput, "projectId" | "activityId" | "delayId">) =>
    api.patch<ActivityDelay>(`/projects/${projectId}/activities/${activityId}/delays/${delayId}`, body).then((r) => r.data),

  // Microsoft Project XML (MSPDI) — the format Project opens directly, and the
  // same one the programme importer reads back.
  exportProgramme: (projectId: string, buildingId?: string) =>
    api
      .get(`/projects/${projectId}/programme/export.xml`, {
        params: buildingId ? { buildingId } : undefined,
        responseType: "blob",
      })
      .then((r) => r.data as Blob),
};
