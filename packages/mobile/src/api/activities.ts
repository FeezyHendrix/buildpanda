import { request } from "./client";

export interface Activity {
  id: string;
  name: string;
  phaseName: string | null;
  location: string | null;
  status: string;
  isDelayed: boolean;
  plannedStartAt: string;
  plannedEndAt: string;
}

export interface DelayReason {
  code: string;
  category: string;
  name: string;
  description: string;
}

export interface RaiseDelayInput {
  reasonCode: string;
  description?: string;
  startedAt: string;
}

export const activitiesApi = {
  list: (projectId: string) => request<Activity[]>(`/projects/${projectId}/activities`),

  delayReasons: () => request<DelayReason[]>("/delay-reasons"),

  raiseDelay: (projectId: string, activityId: string, body: RaiseDelayInput) =>
    request<{ id: string }>(`/projects/${projectId}/activities/${activityId}/delays`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
