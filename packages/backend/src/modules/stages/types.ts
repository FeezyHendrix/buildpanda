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
  /** Planned share of the stage value for this month. */
  percent: number;
  /** Planned amount for this month (percent of the stage value). */
  amount: number;
  billed: boolean;
  sortOrder: number;
  /** Cumulative percent complete recorded for this month; null until recorded. */
  percentComplete: number | null;
  /** Derived from the cumulative figures — see `periodBilling`. */
  periodPercent: number;
  periodAmount: number;
  toDateAmount: number;
}

/** The two inputs `periodBilling` needs from a schedule-of-values line. */
export interface ProgressLineInput {
  period: string;
  percentComplete: number | null;
}

/** One month of a stage's billing, derived from cumulative percent complete. */
export interface PeriodBillingLine {
  period: string;
  cumulativePct: number | null;
  periodPct: number;
  periodAmount: number;
  toDateAmount: number;
}

export interface UpdateScheduleProgressBody {
  percentComplete: number | null;
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
  percent_complete: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}
