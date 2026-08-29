import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { Money } from "../../lib/money.ts";
import type {
  NewStageScheduleOfValueRecord,
  StagesRepository,
  StageUpdatePatch,
} from "./repository.ts";
import type {
  Stage,
  StageRow,
  StageScheduleOfValue,
  StageScheduleOfValueRow,
  StageStatus,
} from "./types.ts";

export interface CreateStageInput {
  name: string;
  buildingId?: string | null;
  status?: StageStatus;
  startDate?: string | null;
  endDate?: string | null;
  progressPercent?: number;
  value?: number;
}

export interface UpdateStageInput {
  name?: string;
  status?: StageStatus;
  startDate?: string | null;
  endDate?: string | null;
  progressPercent?: number;
  value?: number;
}

export interface ScheduleOfValueLineInput {
  period: string;
  percent: number;
  billed?: boolean;
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
    value: Number(row.value),
    sortOrder: row.sort_order,
  };
}

function toScheduleOfValue(row: StageScheduleOfValueRow): StageScheduleOfValue {
  return {
    id: row.id,
    stageId: row.stage_id,
    period: row.period,
    percent: Number(row.percent),
    amount: Number(row.amount),
    billed: row.billed,
    sortOrder: row.sort_order,
  };
}

export function stagesService(
  repository: StagesRepository,
  soleRealBuildingId: (projectId: string) => Promise<string | undefined>,
  contractSumForProject?: (projectId: string) => Promise<number>,
) {
  async function resolveBuildingId(projectId: string, explicit?: string | null): Promise<string> {
    if (explicit) return explicit;
    const buildingId = await soleRealBuildingId(projectId);
    if (!buildingId) throw new BadRequestError("buildingId is required for a multi-building project");
    return buildingId;
  }

  async function assertValuesWithinContract(
    projectId: string,
    stageId: string | null,
    value: number,
  ): Promise<void> {
    if (!contractSumForProject) return;
    const contractSum = await contractSumForProject(projectId);
    if (contractSum <= 0) return;
    const rows = await repository.listByProject(projectId);
    const others = Money.sum(
      rows.filter((row) => row.id !== stageId).map((row) => row.value),
    );
    if (others.add(value).gt(contractSum)) {
      throw new BadRequestError("Stage values exceed the contract sum");
    }
  }

  return {
    async list(projectId: string, buildingId?: string): Promise<Stage[]> {
      const rows = await repository.listByProject(projectId, buildingId);
      return rows.map(toStage);
    },

    async create(projectId: string, input: CreateStageInput): Promise<Stage> {
      const startDate = input.startDate ?? null;
      const endDate = input.endDate ?? null;
      const buildingId = await resolveBuildingId(projectId, input.buildingId);
      if (input.value !== undefined) {
        await assertValuesWithinContract(projectId, null, input.value);
      }
      const sortOrder = await repository.nextSortOrder(projectId);
      const row = await repository.create({
        id: generateId("stage"),
        project_id: projectId,
        building_id: buildingId,
        name: input.name,
        status: input.status ?? "Pending",
        date_range: deriveDateRange(startDate, endDate),
        start_date: startDate,
        end_date: endDate,
        progress_percent: clampPercent(input.progressPercent, 0),
        value: String(input.value ?? 0),
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
      if (input.value !== undefined) {
        await assertValuesWithinContract(projectId, stageId, input.value);
        patch.value = String(input.value);
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

    async listScheduleOfValues(
      projectId: string,
      stageId?: string,
    ): Promise<StageScheduleOfValue[]> {
      const rows = stageId
        ? await repository.listScheduleOfValuesByStage(projectId, stageId)
        : await repository.listScheduleOfValuesByProject(projectId);
      return rows.map(toScheduleOfValue);
    },

    async replaceScheduleOfValues(
      projectId: string,
      stageId: string,
      lines: ScheduleOfValueLineInput[],
    ): Promise<StageScheduleOfValue[]> {
      const stage = await repository.findById(stageId);
      if (!stage || stage.project_id !== projectId) throw new NotFoundError("Stage");

      const totalPercent = Money.sum(lines.map((line) => line.percent));
      if (totalPercent.gt(100)) {
        throw new BadRequestError(
          "Schedule of Values cannot bill more than 100% of the stage value",
        );
      }

      const billedTotal = Money.of(stage.value).percent(totalPercent);
      const amounts = billedTotal.allocate(lines.map((line) => line.percent));
      const records: NewStageScheduleOfValueRecord[] = lines.map((line, index) => ({
        id: generateId("sov"),
        project_id: projectId,
        stage_id: stageId,
        period: line.period,
        percent: String(line.percent),
        amount: amounts[index]?.toFixed(2) ?? "0.00",
        billed: line.billed ?? false,
        sort_order: index,
      }));

      await repository.replaceScheduleOfValues(stageId, records);
      const rows = await repository.listScheduleOfValuesByStage(projectId, stageId);
      return rows.map(toScheduleOfValue);
    },
  };
}

export type StagesService = ReturnType<typeof stagesService>;
