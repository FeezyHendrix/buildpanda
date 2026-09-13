import api from "./client";
import type { Stage, StageStatus } from "@/lib/project-types";

export interface StageInput {
  name: string;
  buildingId?: string;
  status?: StageStatus;
  startDate?: string | null;
  endDate?: string | null;
  progressPercent?: number;
  value?: number;
  contractId?: string | null;
  expectedCost?: number | null;
  estimatedLaborHours?: number | null;
  laborBudget?: number | null;
  materialBudget?: number | null;
}

export interface StageScheduleOfValue {
  id: string;
  stageId: string;
  period: string;
  /** Planned share of the stage value for this month. */
  percent: number;
  amount: number;
  billed: boolean;
  sortOrder: number;
  /** Cumulative % complete recorded for the month; null until recorded. */
  percentComplete: number | null;
  /** This month's movement, priced by the backend off the cumulative figures. */
  periodPercent: number;
  periodAmount: number;
  toDateAmount: number;
  /** A month later than the current one: the QS's projection, never a claim. */
  forecast?: boolean;
  /** False for a forecast month and for one already certified on an invoice. */
  claimable?: boolean;
}

export interface UpdateScheduleProgressInput {
  stageId: string;
  period: string;
  percentComplete: number | null;
  /** Required to value a month that has not happened yet; it is stored as a forecast. */
  forecast?: boolean;
}

export interface ScheduleOfValueLineInput {
  period: string;
  percent: number;
  billed?: boolean;
}

/** Stage values against the contract sum — "₦850m of ₦850m allocated". */
export interface StageValueSummary {
  valueTotal: number;
  contractSum: number;
  /** `contractSum - valueTotal`; negative when the stages are over-allocated. */
  unallocated: number;
  allocatedPercent: number;
}

export const stagesApi = {
  list: (projectId: string, buildingId?: string) =>
    api.get<Stage[]>(`/projects/${projectId}/stages`, { params: buildingId ? { buildingId } : undefined }).then((r) => r.data),

  create: (projectId: string, body: StageInput) =>
    api.post<Stage>(`/projects/${projectId}/stages`, body).then((r) => r.data),

  update: (projectId: string, stageId: string, body: Partial<StageInput>) =>
    api.patch<Stage>(`/projects/${projectId}/stages/${stageId}`, body).then((r) => r.data),

  valueSummary: (projectId: string) =>
    api
      .get<StageValueSummary>(`/projects/${projectId}/stages/value-summary`)
      .then((r) => r.data),

  remove: (projectId: string, stageId: string) =>
    api.delete(`/projects/${projectId}/stages/${stageId}`).then((r) => r.data),

  reorder: (projectId: string, stageIds: string[]) =>
    api.patch<Stage[]>(`/projects/${projectId}/stages/reorder`, { stageIds }).then((r) => r.data),

  scheduleOfValues: (projectId: string, stageId: string) =>
    api
      .get<StageScheduleOfValue[]>(`/projects/${projectId}/stages/${stageId}/schedule-of-values`)
      .then((r) => r.data),

  projectScheduleOfValues: (projectId: string) =>
    api
      .get<StageScheduleOfValue[]>(`/projects/${projectId}/schedule-of-values`)
      .then((r) => r.data),

  /** One billing-sheet cell: cumulative % complete for a stage-month. */
  updateScheduleProgress: (projectId: string, input: UpdateScheduleProgressInput) =>
    api
      .patch<StageScheduleOfValue[]>(
        `/projects/${projectId}/stages/${input.stageId}/schedule-of-values/${input.period}`,
        input.forecast
          ? { percentComplete: input.percentComplete, forecast: true }
          : { percentComplete: input.percentComplete },
      )
      .then((r) => r.data),

  replaceScheduleOfValues: (
    projectId: string,
    stageId: string,
    lines: ScheduleOfValueLineInput[],
  ) =>
    api
      .put<StageScheduleOfValue[]>(
        `/projects/${projectId}/stages/${stageId}/schedule-of-values`,
        { lines },
      )
      .then((r) => r.data),
};
