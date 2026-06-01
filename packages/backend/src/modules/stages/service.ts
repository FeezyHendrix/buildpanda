import { NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { StagesRepository, StageUpdatePatch } from "./repository.ts";
import type { Stage, StageRow, StageStatus } from "./types.ts";

export interface CreateStageInput {
  name: string;
  status?: StageStatus;
  startDate?: string | null;
  endDate?: string | null;
  progressPercent?: number;
}

export interface UpdateStageInput {
  name?: string;
  status?: StageStatus;
  startDate?: string | null;
  endDate?: string | null;
  progressPercent?: number;
}

function fmt(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function deriveDateRange(start: string | null, end: string | null): string | null {
  const s = fmt(start);
  const e = fmt(end);
  if (s && e) return `${s} – ${e}`;
  if (s) return `From ${s}`;
  if (e) return `Until ${e}`;
  return null;
}

function clampPercent(value: number | undefined, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toStage(row: StageRow): Stage {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    dateRange: row.date_range,
    progressPercent: row.progress_percent,
    sortOrder: row.sort_order,
  };
}

export function stagesService(repository: StagesRepository) {
  return {
    async list(projectId: string): Promise<Stage[]> {
      const rows = await repository.listByProject(projectId);
      return rows.map(toStage);
    },

    async create(projectId: string, input: CreateStageInput): Promise<Stage> {
      const startDate = input.startDate ?? null;
      const endDate = input.endDate ?? null;
      const sortOrder = await repository.nextSortOrder(projectId);
      const row = await repository.create({
        id: generateId("stage"),
        project_id: projectId,
        name: input.name,
        status: input.status ?? "Pending",
        date_range: deriveDateRange(startDate, endDate),
        start_date: startDate,
        end_date: endDate,
        progress_percent: clampPercent(input.progressPercent, 0),
        sort_order: sortOrder,
      });
      return toStage(row);
    },

    async update(
      projectId: string,
      stageId: string,
      input: UpdateStageInput,
    ): Promise<Stage> {
      const existing = await repository.findById(stageId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Stage");

      const patch: StageUpdatePatch = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.status !== undefined) patch.status = input.status;
      if (input.progressPercent !== undefined) {
        patch.progress_percent = clampPercent(input.progressPercent, existing.progress_percent);
      }
      const startProvided = input.startDate !== undefined;
      const endProvided = input.endDate !== undefined;
      if (startProvided) patch.start_date = input.startDate ?? null;
      if (endProvided) patch.end_date = input.endDate ?? null;
      if (startProvided || endProvided) {
        patch.date_range = deriveDateRange(
          startProvided ? input.startDate ?? null : existing.start_date,
          endProvided ? input.endDate ?? null : existing.end_date,
        );
      }

      const updated = await repository.update(stageId, patch);
      if (!updated) throw new NotFoundError("Stage");
      return toStage(updated);
    },

    async remove(projectId: string, stageId: string): Promise<void> {
      const existing = await repository.findById(stageId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Stage");
      await repository.remove(stageId);
    },

    async reorder(projectId: string, orderedIds: string[]): Promise<Stage[]> {
      await repository.reorder(projectId, orderedIds);
      const rows = await repository.listByProject(projectId);
      return rows.map(toStage);
    },
  };
}

export type StagesService = ReturnType<typeof stagesService>;
