import api from "./client";

export type BuildingPhaseStatus = "Completed" | "In Progress" | "Not started";

/** A named group of build stages. Count, progress and status are derived by the backend from its stages. */
export interface BuildingPhase {
  id: string;
  projectId: string;
  buildingId: string;
  name: string;
  sortOrder: number;
  stageCount: number;
  progressPercent: number;
  status: BuildingPhaseStatus;
}

export interface CreateBuildingPhaseInput {
  name: string;
  buildingId?: string;
}

export const buildingPhasesApi = {
  list: (projectId: string, buildingId?: string) =>
    api
      .get<BuildingPhase[]>(`/projects/${projectId}/building-phases`, {
        params: buildingId ? { buildingId } : undefined,
      })
      .then((r) => r.data),

  create: (projectId: string, body: CreateBuildingPhaseInput) =>
    api.post<BuildingPhase>(`/projects/${projectId}/building-phases`, body).then((r) => r.data),

  rename: (projectId: string, phaseId: string, name: string) =>
    api.patch<BuildingPhase>(`/projects/${projectId}/building-phases/${phaseId}`, { name }).then((r) => r.data),
};
