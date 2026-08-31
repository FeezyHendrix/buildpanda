import type { Knex } from "knex";
import type { StageRow, StageStatus, StageScheduleOfValueRow } from "./types.ts";

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
  };
}

export type StagesRepository = ReturnType<typeof stagesRepository>;
