export type BuildingKind = "real" | "shared";
export type BuildingStatus = "planned" | "active" | "completed" | "on_hold";

export interface Building {
  id: string;
  projectId: string;
  name: string;
  code: string | null;
  kind: BuildingKind;
  status: BuildingStatus;
  progressPercent: number;
  sortOrder: number;
}

export interface BuildingRow {
  id: string;
  project_id: string;
  name: string;
  code: string | null;
  kind: BuildingKind;
  status: BuildingStatus;
  progress_percent: number;
  sort_order: number;
  created_at: Date | string;
  updated_at: Date | string;
}
