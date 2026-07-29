import api from "./client";

export type BuildingStatus = "planned" | "active" | "completed" | "on_hold";

export interface Building {
  id: string;
  projectId: string;
  name: string;
  code: string | null;
  kind: "real" | "shared";
  status: BuildingStatus;
  progressPercent: number;
  sortOrder: number;
}

export interface BuildingInput {
  name: string;
  code?: string;
  status?: BuildingStatus;
  progressPercent?: number;
}

export const buildingsApi = {
  list: (projectId: string) =>
    api.get<Building[]>(`/projects/${projectId}/buildings`).then((r) => r.data),

  create: (projectId: string, body: BuildingInput) =>
    api.post<Building>(`/projects/${projectId}/buildings`, body).then((r) => r.data),

  update: (projectId: string, buildingId: string, body: Partial<BuildingInput>) =>
    api.patch<Building>(`/projects/${projectId}/buildings/${buildingId}`, body).then((r) => r.data),

  remove: (projectId: string, buildingId: string) =>
    api.delete(`/projects/${projectId}/buildings/${buildingId}`).then((r) => r.data),

  reorder: (projectId: string, buildingIds: string[]) =>
    api.patch<Building[]>(`/projects/${projectId}/buildings/reorder`, { buildingIds }).then((r) => r.data),

  cloneProgramme: (projectId: string, buildingId: string, fromBuildingId: string) =>
    api.post(`/projects/${projectId}/buildings/${buildingId}/clone-programme`, { fromBuildingId }).then((r) => r.data),
};
