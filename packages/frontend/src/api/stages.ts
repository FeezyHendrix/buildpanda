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

export interface ScheduleOfValueLineInput {
  period: string;
  percent: number;
  billed?: boolean;
}

export const stagesApi = {
  list: (projectId: string, buildingId?: string) =>
    api.get<Stage[]>(`/projects/${projectId}/stages`, { params: buildingId ? { buildingId } : undefined }).then((r) => r.data),

  create: (projectId: string, body: StageInput) =>
    api.post<Stage>(`/projects/${projectId}/stages`, body).then((r) => r.data),

  update: (projectId: string, stageId: string, body: Partial<StageInput>) =>
    api.patch<Stage>(`/projects/${projectId}/stages/${stageId}`, body).then((r) => r.data),

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
