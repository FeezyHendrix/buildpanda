import api from "./client";

export interface ActivityLookAheadReference {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
}

export interface ActivityDelayReference {
  id: string;
  reasonCode: string;
  startedAt: string;
  resolved: boolean;
}

export interface ActivityReferences {
  activityId: string;
  lookAheads: ActivityLookAheadReference[];
  blockedByApprovedLookAhead: boolean;
  delays: ActivityDelayReference[];
  openDelayCount: number;
}

export const activityReferencesApi = {
  get: (projectId: string, activityId: string) =>
    api
      .get<ActivityReferences>(`/projects/${projectId}/activities/${activityId}/references`)
      .then((r) => r.data),
};
