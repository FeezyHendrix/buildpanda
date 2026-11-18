import type { PhaseStatus } from "../projects/types.ts";

export type StageStatus = PhaseStatus; // "Done" | "InProgress" | "Pending"

export interface Stage {
  buildingId: string;
  /** The building phase (`building_phases`) the stage is grouped under; null until assigned. */
  buildingPhaseId: string | null;
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
  /** The contract the stage bills against; a null column resolves to the main contract. */
  contractId: string | null;
  /** Estimate figures entered on the Phases tab. */
  expectedCost: number;
  estimatedLaborHours: number;
  laborBudget: number;
  materialBudget: number;
  /** Used figures rolled up from daily logs, purchase orders and expenses. */
  usedLaborHours: number;
  usedMaterialCost: number;
  totalCost: number;
}

export interface StageRow {
  id: string;
  project_id: string;
  building_id: string;
  building_phase_id: string | null;
  name: string;
  status: StageStatus;
  date_range: string | null;
  start_date: string | null;
  end_date: string | null;
  progress_percent: number;
  value: string;
  sort_order: number;
  contract_id: string | null;
  expected_cost: string;
  estimated_labor_hours: string;
  labor_budget: string;
  material_budget: string;
}

/** What each stage has used so far, stitched from three module sums. */
export interface StageUsage {
  usedLaborHours: number;
  usedMaterialCost: number;
  totalCost: number;
}

/** Stage count per contract; a null `contract_id` is the main-contract bucket. */
export interface StageContractCountRow {
  contract_id: string | null;
  count: string;
}

/** What the stage service needs to know about a building phase to accept it. */
export interface BuildingPhaseScope {
  project_id: string;
  building_id: string;
}

export interface ReorderStagesBody {
  stageIds: string[];
  /** Given: `stageIds` is that phase's new order, and every listed stage moves into it. */
  buildingPhaseId?: string;
}

export interface UpdateStageInput {
  buildingPhaseId?: string | null;
  name?: string;
  status?: StageStatus;
  startDate?: string | null;
  endDate?: string | null;
  progressPercent?: number;
  value?: number;
  contractId?: string | null;
  expectedCost?: number;
  estimatedLaborHours?: number;
  laborBudget?: number;
  materialBudget?: number;
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
  /** A month later than the current one: a projection, not work done. */
  forecast?: boolean;
  /** False for a forecast month and for one already certified. See `period-lock.ts`. */
  claimable?: boolean;
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
  /** Required to record a month that has not happened yet. See `period-lock.ts`. */
  forecast?: boolean;
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
