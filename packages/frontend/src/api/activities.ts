import api from "./client";
import type {
  Activity,
  ActivityDelay,
  ActivityStatus,
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
}
export interface DeleteActivityInput {
  projectId: string;
  activityId: string;
}
export interface RaiseDelayInput {
  projectId: string;
  activityId: string;
  reasonCode: string;
  description?: string;
  startedAt: string;
  costImpact?: number;
  currency?: Currency;
  preventionNotes?: string;
}
export interface ResolveDelayInput {
  projectId: string;
  activityId: string;
  delayId: string;
  resolvedAt: string;
  preventionNotes?: string;
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
    api.post<Activity>(`/projects/${projectId}/activities`, body).then((r) => r.data),

  update: (projectId: string, activityId: string, body: Omit<UpdateActivityInput, "projectId" | "activityId">) =>
    api.patch<Activity>(`/projects/${projectId}/activities/${activityId}`, body).then((r) => r.data),

  delete: (projectId: string, activityId: string) =>
    api.delete(`/projects/${projectId}/activities/${activityId}`).then((r) => r.data),

  raiseDelay: (projectId: string, activityId: string, body: Omit<RaiseDelayInput, "projectId" | "activityId">) =>
    api.post<ActivityDelay>(`/projects/${projectId}/activities/${activityId}/delays`, body).then((r) => r.data),

  resolveDelay: (projectId: string, activityId: string, delayId: string, body: Omit<ResolveDelayInput, "projectId" | "activityId" | "delayId">) =>
    api.patch<ActivityDelay>(`/projects/${projectId}/activities/${activityId}/delays/${delayId}`, body).then((r) => r.data),
};
