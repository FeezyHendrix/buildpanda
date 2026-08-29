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
  value: number;
  sortOrder: number;
}

export interface StageRow {
  id: string;
  project_id: string;
  building_id: string;
  name: string;
  status: StageStatus;
  date_range: string | null;
  start_date: string | null;
  end_date: string | null;
  progress_percent: number;
  value: string;
  sort_order: number;
}

export interface StageScheduleOfValue {
  id: string;
  stageId: string;
  period: string;
  percent: number;
  amount: number;
  billed: boolean;
  sortOrder: number;
}

export interface StageScheduleOfValueRow {
  id: string;
  project_id: string;
  stage_id: string;
  period: string;
  percent: string;
  amount: string;
  billed: boolean;
  sort_order: number;
  created_at: Date | string;
  updated_at: Date | string;
}
