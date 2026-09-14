import type { Knex } from "knex";
import type {
  StageContractCountRow,
  StageRow,
  StageStatus,
  StageScheduleOfValueRow,
} from "./types.ts";

export interface NewStageRecord {
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
  contract_id: string | null;
}

export interface StageUpdatePatch {
  name?: string;
  status?: StageStatus;
  date_range?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  progress_percent?: number;
  value?: string;
  sort_order?: number;
  contract_id?: string | null;
  expected_cost?: string;
  estimated_labor_hours?: string;
  labor_budget?: string;
  material_budget?: string;
}

export interface NewStageScheduleOfValueRecord {
  id: string;
  project_id: string;
  stage_id: string;
  period: string;
  percent: string;
  amount: string;
  billed: boolean;
  sort_order: number;
  percent_complete: string | null;
}

export interface ScheduleProgressRecord {
  id: string;
  project_id: string;
  stage_id: string;
  period: string;
  percent_complete: string | null;
}

const COLUMNS = [
  "id",
  "project_id",
  "building_id",
  "name",
  "status",
  "date_range",
  "start_date",
  "end_date",
  "progress_percent",
  "value",
  "sort_order",
  "contract_id",
  "expected_cost",
  "estimated_labor_hours",
  "labor_budget",
  "material_budget",
] as const;

export function stagesRepository(db: Knex) {
  return {
    listByProject(projectId: string, buildingId?: string): Promise<StageRow[]> {
      const where: Record<string, string> = { project_id: projectId };
      if (buildingId) where.building_id = buildingId;
      return db<StageRow>("project_phases")
        .where(where)
        .select(...COLUMNS)
        .orderBy("sort_order", "asc");
    },

    findById(id: string): Promise<StageRow | undefined> {
      return db<StageRow>("project_phases").where({ id }).select(...COLUMNS).first();
    },

    async nextSortOrder(projectId: string): Promise<number> {
      const row = await db("project_phases")
        .where({ project_id: projectId })
        .max<{ max: number | null }[]>("sort_order as max")
        .first();
      return (row?.max ?? -1) + 1;
    },

    async create(record: NewStageRecord): Promise<StageRow> {
      const [row] = await db("project_phases").insert(record).returning(COLUMNS as unknown as string[]);
      if (!row) throw new Error("Failed to insert stage");
      return row as StageRow;
    },

    async update(id: string, patch: StageUpdatePatch): Promise<StageRow | undefined> {
      const [row] = await db("project_phases")
        .where({ id })
        .update(patch)
        .returning(COLUMNS as unknown as string[]);
      return row as StageRow | undefined;
    },

    async remove(id: string): Promise<void> {
      await db("project_phases").where({ id }).del();
    },

    /** One row per contract (null = main contract) with how many stages sit on it. */
    countByContract(projectId: string): Promise<StageContractCountRow[]> {
      return db("project_phases")
        .where({ project_id: projectId })
        .groupBy("contract_id")
        .select("contract_id")
        .count<StageContractCountRow[]>("id as count");
    },

    /** Persists a new ordering; sort_order = index in the provided id list. */
    async reorder(projectId: string, orderedIds: string[]): Promise<void> {
      await db.transaction(async (trx) => {
        for (let i = 0; i < orderedIds.length; i += 1) {
          await trx("project_phases")
            .where({ id: orderedIds[i], project_id: projectId })
            .update({ sort_order: i });
        }
      });
    },

    listScheduleOfValuesByProject(projectId: string): Promise<StageScheduleOfValueRow[]> {
      return db<StageScheduleOfValueRow>("stage_schedule_of_values")
        .where({ project_id: projectId })
        .orderBy([
          { column: "stage_id", order: "asc" },
          { column: "sort_order", order: "asc" },
        ]);
    },

    listScheduleOfValuesByStage(
      projectId: string,
      stageId: string,
    ): Promise<StageScheduleOfValueRow[]> {
      return db<StageScheduleOfValueRow>("stage_schedule_of_values")
        .where({ project_id: projectId, stage_id: stageId })
        .orderBy("sort_order", "asc");
    },

    async replaceScheduleOfValues(
      stageId: string,
      records: NewStageScheduleOfValueRecord[],
    ): Promise<void> {
      await db.transaction(async (trx) => {
        await trx("stage_schedule_of_values").where({ stage_id: stageId }).del();
        if (records.length > 0) {
          await trx("stage_schedule_of_values").insert(records);
        }
      });
    },

    /**
     * Records cumulative progress for one month, creating the line when the
     * month has no planned share yet. Lines are then renumbered by period so
     * the drawer and the sheet read the months in calendar order.
     */
    async upsertScheduleProgress(record: ScheduleProgressRecord): Promise<void> {
      await db.transaction(async (trx) => {
        await trx("stage_schedule_of_values")
          .insert({ ...record, percent: "0", amount: "0.00", billed: false, sort_order: 0 })
          .onConflict(["stage_id", "period"])
          .merge({ percent_complete: record.percent_complete, updated_at: trx.fn.now() });
        await trx.raw(
          `UPDATE stage_schedule_of_values AS s
             SET sort_order = ranked.rn - 1
            FROM (SELECT id, row_number() OVER (ORDER BY period) AS rn
                    FROM stage_schedule_of_values WHERE stage_id = ?) AS ranked
           WHERE s.id = ranked.id`,
          [record.stage_id],
        );
      });
    },

    /** Flags a month as invoiced on the given stages (a progress invoice was raised for it). */
    async markScheduleOfValuesBilled(
      projectId: string,
      period: string,
      stageIds: string[],
    ): Promise<void> {
      if (stageIds.length === 0) return;
      await db("stage_schedule_of_values")
        .where({ project_id: projectId, period })
        .whereIn("stage_id", stageIds)
        .update({ billed: true, updated_at: db.fn.now() });
    },
  };
}

export type StagesRepository = ReturnType<typeof stagesRepository>;
