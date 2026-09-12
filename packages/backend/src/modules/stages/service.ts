import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { Money } from "../../lib/money.ts";
import type {
  NewStageScheduleOfValueRecord,
  StagesRepository,
  StageUpdatePatch,
} from "./repository.ts";
import { periodBilling } from "./period-billing.ts";
import type { PhaseRollupService } from "./phase-rollup.ts";
import { clampPercent, deriveDateRange, toStage } from "./stage-mapper.ts";
import type {
  PeriodBillingLine,
  Stage,
  StageRow,
  StageScheduleOfValue,
  StageScheduleOfValueRow,
  StageStatus,
  UpdateStageInput,
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

export interface ScheduleOfValueLineInput {
  period: string;
  percent: number;
  billed?: boolean;
}

/**
 * The Phases-tab half of the stage: contract attribution and the estimate vs
 * used roll-up. Optional so sheet-only callers (pay applications) can build the
 * service without wiring three more modules.
 */
export interface StagePhaseDeps {
  rollup: PhaseRollupService;
  contractBelongsToProject: (projectId: string, contractId: string) => Promise<boolean>;
}

function percentCompleteOf(row: StageScheduleOfValueRow): number | null {
  return row.percent_complete === null ? null : Number(row.percent_complete);
}

function toScheduleOfValue(
  row: StageScheduleOfValueRow,
  billing: PeriodBillingLine | undefined,
): StageScheduleOfValue {
  return {
    id: row.id,
    stageId: row.stage_id,
    period: row.period,
    percent: Number(row.percent),
    amount: Number(row.amount),
    billed: row.billed,
    sortOrder: row.sort_order,
    percentComplete: percentCompleteOf(row),
    periodPercent: billing?.periodPct ?? 0,
    periodAmount: billing?.periodAmount ?? 0,
    toDateAmount: billing?.toDateAmount ?? 0,
  };
}

/**
 * Prices every line's period figures off its stage's scheduled value. One
 * `periodBilling` per stage, so a project-wide list stays a single pass.
 */
function toScheduleOfValues(
  rows: StageScheduleOfValueRow[],
  valueByStage: Map<string, number>,
): StageScheduleOfValue[] {
  const byStage = new Map<string, StageScheduleOfValueRow[]>();
  for (const row of rows) {
    const bucket = byStage.get(row.stage_id);
    if (bucket) bucket.push(row);
    else byStage.set(row.stage_id, [row]);
  }
  const billingByKey = new Map<string, PeriodBillingLine>();
  for (const [stageId, stageRows] of byStage) {
    const lines = periodBilling(
      stageRows.map((row) => ({ period: row.period, percentComplete: percentCompleteOf(row) })),
      valueByStage.get(stageId) ?? 0,
    );
    for (const line of lines) billingByKey.set(`${stageId}:${line.period}`, line);
  }
  return rows.map((row) => toScheduleOfValue(row, billingByKey.get(`${row.stage_id}:${row.period}`)));
}

function recordedBefore(rows: StageScheduleOfValueRow[], period: string): StageScheduleOfValueRow | undefined {
  let found: StageScheduleOfValueRow | undefined;
  for (const row of rows) {
    if (row.period >= period || row.percent_complete === null) continue;
    if (!found || row.period > found.period) found = row;
  }
  return found;
}

function recordedAfter(rows: StageScheduleOfValueRow[], period: string): StageScheduleOfValueRow | undefined {
  let found: StageScheduleOfValueRow | undefined;
  for (const row of rows) {
    if (row.period <= period || row.percent_complete === null) continue;
    if (!found || row.period < found.period) found = row;
  }
  return found;
}

const ACTIVE_STATUSES: ReadonlySet<StageStatus> = new Set(["InProgress", "Done"]);

export function stagesService(
  repository: StagesRepository,
  soleRealBuildingId: (projectId: string) => Promise<string | undefined>,
  contractSumForProject?: (projectId: string) => Promise<number>,
  // Reaching a stage unlocks its stage payments; wired to the finances claim
  // chain by the route plugin so this module never touches finance tables.
  onStageReached?: (projectId: string, stage: { id: string; name: string }) => Promise<void>,
  phases?: StagePhaseDeps,
) {
  async function decorate(projectId: string, rows: StageRow[]): Promise<Stage[]> {
    if (!phases) return rows.map((row) => toStage(row));
    const rollup = await phases.rollup.forProject(projectId);
    return rows.map((row) => toStage(row, rollup));
  }

  async function one(projectId: string, row: StageRow): Promise<Stage> {
    const [stage] = await decorate(projectId, [row]);
    return stage as Stage;
  }

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
      return decorate(projectId, rows);
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
        contract_id: null,
      });
      return one(projectId, row);
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
      if (input.expectedCost !== undefined) patch.expected_cost = input.expectedCost.toFixed(2);
      if (input.estimatedLaborHours !== undefined) patch.estimated_labor_hours = input.estimatedLaborHours.toFixed(2);
      if (input.laborBudget !== undefined) patch.labor_budget = input.laborBudget.toFixed(2);
      if (input.materialBudget !== undefined) patch.material_budget = input.materialBudget.toFixed(2);
      if (input.contractId !== undefined) {
        if (input.contractId !== null) {
          const owned = phases ? await phases.contractBelongsToProject(projectId, input.contractId) : false;
          if (!owned) throw new BadRequestError("Contract does not belong to this project");
        }
        patch.contract_id = input.contractId;
      }

      const updated = await repository.update(stageId, patch);
      if (!updated) throw new NotFoundError("Stage");
      const reached =
        input.status !== undefined && ACTIVE_STATUSES.has(input.status) && !ACTIVE_STATUSES.has(existing.status);
      if (reached && onStageReached) {
        await onStageReached(projectId, { id: updated.id, name: updated.name });
      }
      return one(projectId, updated);
    },

    async remove(projectId: string, stageId: string): Promise<void> {
      const existing = await repository.findById(stageId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Stage");
      await repository.remove(stageId);
    },

    async reorder(projectId: string, orderedIds: string[]): Promise<Stage[]> {
      await repository.reorder(projectId, orderedIds);
      const rows = await repository.listByProject(projectId);
      return decorate(projectId, rows);
    },

    async listScheduleOfValues(
      projectId: string,
      stageId?: string,
    ): Promise<StageScheduleOfValue[]> {
      const [rows, stages] = await Promise.all([
        stageId
          ? repository.listScheduleOfValuesByStage(projectId, stageId)
          : repository.listScheduleOfValuesByProject(projectId),
        repository.listByProject(projectId),
      ]);
      return toScheduleOfValues(rows, new Map(stages.map((stage) => [stage.id, Number(stage.value)])));
    },

    /**
     * Records the cumulative percent complete for one stage-month, the cell a
     * QS types into on the billing sheet. Progress is cumulative, so a month can
     * never sit below the last recorded month or above the next one; clearing
     * runs from the latest month backwards so no gap opens in the middle.
     */
    async updateScheduleProgress(
      projectId: string,
      stageId: string,
      period: string,
      percentComplete: number | null,
    ): Promise<StageScheduleOfValue[]> {
      const stage = await repository.findById(stageId);
      if (!stage || stage.project_id !== projectId) throw new NotFoundError("Stage");
      if (Number(stage.value) <= 0) {
        throw new BadRequestError("Price the stage before recording progress against it");
      }
      const rows = await repository.listScheduleOfValuesByStage(projectId, stageId);
      const others = rows.filter((row) => row.period !== period);
      const previous = recordedBefore(others, period);
      const next = recordedAfter(others, period);

      if (percentComplete === null) {
        if (next) {
          throw new ConflictError(
            `Clear ${next.period} first — progress is cumulative, so months are cleared from the latest one backwards`,
          );
        }
      } else {
        if (previous && percentComplete < Number(previous.percent_complete)) {
          throw new ConflictError(
            `${period} cannot fall below ${previous.period}'s ${Number(previous.percent_complete)}% — progress is cumulative`,
          );
        }
        if (next && percentComplete > Number(next.percent_complete)) {
          throw new ConflictError(
            `${period} cannot exceed ${next.period}'s ${Number(next.percent_complete)}% — progress is cumulative`,
          );
        }
      }

      await repository.upsertScheduleProgress({
        id: generateId("sov"),
        project_id: projectId,
        stage_id: stageId,
        period,
        percent_complete: percentComplete === null ? null : String(percentComplete),
      });
      const updated = await repository.listScheduleOfValuesByStage(projectId, stageId);
      return toScheduleOfValues(updated, new Map([[stageId, Number(stage.value)]]));
    },

    /** Flags a month as invoiced on the given stages once a progress invoice is raised for it. */
    async markPeriodBilled(projectId: string, period: string, stageIds: string[]): Promise<void> {
      await repository.markScheduleOfValuesBilled(projectId, period, stageIds);
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

      // Replacing the planned schedule must not wipe the progress already
      // recorded on those months — carry it across by period.
      const existing = await repository.listScheduleOfValuesByStage(projectId, stageId);
      const progressByPeriod = new Map(existing.map((row) => [row.period, row.percent_complete]));

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
        percent_complete: progressByPeriod.get(line.period) ?? null,
      }));

      await repository.replaceScheduleOfValues(stageId, records);
      const rows = await repository.listScheduleOfValuesByStage(projectId, stageId);
      return toScheduleOfValues(rows, new Map([[stageId, Number(stage.value)]]));
    },
  };
}

export type StagesService = ReturnType<typeof stagesService>;
