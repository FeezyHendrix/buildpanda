import type { PhaseStatus } from "../projects/types.ts";

export type StageStatus = PhaseStatus; // "Done" | "InProgress" | "Pending"

export interface Stage {
  id: string;
  projectId: string;
  name: string;
  status: StageStatus;
  startDate: string | null;
  endDate: string | null;
  dateRange: string | null;
  progressPercent: number;
  sortOrder: number;
}

export interface StageRow {
  id: string;
  project_id: string;
  name: string;
  status: StageStatus;
  date_range: string | null;
  start_date: string | null;
  end_date: string | null;
  progress_percent: number;
  sort_order: number;
}
