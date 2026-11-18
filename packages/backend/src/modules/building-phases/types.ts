import type { StageRow } from "../stages/types.ts";

export const BUILDING_PHASE_STATUSES = ["Completed", "In Progress", "Not started"] as const;
export type BuildingPhaseStatus = (typeof BUILDING_PHASE_STATUSES)[number];

export const BUILDING_PHASE_NAME_MAX = 80;

export interface BuildingPhaseRow {
  id: string;
  project_id: string;
  building_id: string;
  name: string;
  sort_order: number;
  created_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export type NewBuildingPhaseRecord = Omit<BuildingPhaseRow, "created_at" | "updated_at">;

/** Count, progress and status are derived from the phase's stages, never stored. */
export interface BuildingPhaseProgress {
  stageCount: number;
  progressPercent: number;
  status: BuildingPhaseStatus;
}

export interface BuildingPhase extends BuildingPhaseProgress {
  id: string;
  projectId: string;
  buildingId: string;
  name: string;
  sortOrder: number;
}

/** The stage fields a phase is derived from. */
export type PhaseStageRow = Pick<StageRow, "building_phase_id" | "status" | "progress_percent">;

export interface BuildingPhaseDeps {
  /** The stages module's own list; phases are derived from it in memory. */
  stagesForProject: (projectId: string) => Promise<PhaseStageRow[]>;
  soleRealBuildingId: (projectId: string) => Promise<string | undefined>;
  buildingBelongsToProject: (projectId: string, buildingId: string) => Promise<boolean>;
}

export interface CreateBuildingPhaseBody {
  name: string;
  buildingId?: string;
}

export interface UpdateBuildingPhaseBody {
  name: string;
}
