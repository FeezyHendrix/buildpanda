import { request } from "./client";

export interface Building {
  id: string;
  name: string;
  code: string | null;
  kind: string;
  status: string;
  progressPercent: number;
}

export const buildingsApi = {
  list: (projectId: string) => request<Building[]>(`/projects/${projectId}/buildings`),
};

/**
 * Only "real" buildings can hold records — the others are planning placeholders
 * the API will not accept a write against.
 */
export function realBuildings(buildings: readonly Building[]): Building[] {
  return buildings.filter((building) => building.kind === "real");
}
