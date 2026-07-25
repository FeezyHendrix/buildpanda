import type { Knex } from "knex";
import type { BuildingRow, BuildingStatus } from "./types.ts";

export interface NewBuildingRecord {
  id: string;
  project_id: string;
  name: string;
  code: string | null;
  status: BuildingStatus;
  sort_order: number;
  progress_percent: number;
}

export interface BuildingUpdatePatch {
  name?: string;
  code?: string | null;
  status?: BuildingStatus;
  progress_percent?: number;
  sort_order?: number;
}

const COLUMNS = [
  "id",
  "project_id",
  "name",
  "code",
  "kind",
  "status",
  "progress_percent",
  "sort_order",
  "created_at",
  "updated_at",
] as const;

export function buildingsRepository(db: Knex) {
  return {
    listByProject(projectId: string): Promise<BuildingRow[]> {
      return db<BuildingRow>("buildings")
        .where({ project_id: projectId, kind: "real" })
        .select(...COLUMNS)
        .orderBy("sort_order", "asc");
    },

    findById(id: string): Promise<BuildingRow | undefined> {
      return db<BuildingRow>("buildings").where({ id }).select(...COLUMNS).first();
    },

    async sharedBuildingId(projectId: string): Promise<string | undefined> {
      const row = await db<BuildingRow>("buildings")
        .where({ project_id: projectId, kind: "shared" })
        .select("id")
        .first();
      return row?.id;
    },

    async soleRealBuildingId(projectId: string): Promise<string | undefined> {
      const rows = await db<BuildingRow>("buildings")
        .where({ project_id: projectId, kind: "real" })
        .select("id")
        .limit(2);
      return rows.length === 1 ? rows[0]?.id : undefined;
    },

    async firstRealBuildingId(projectId: string): Promise<string | undefined> {
      const row = await db<BuildingRow>("buildings")
        .where({ project_id: projectId, kind: "real" })
        .orderBy("sort_order", "asc")
        .select("id")
        .first();
      return row?.id;
    },

    async countReal(projectId: string): Promise<number> {
      const row = await db("buildings")
        .where({ project_id: projectId, kind: "real" })
        .count<{ count: string }[]>("id as count")
        .first();
      return Number(row?.count ?? 0);
    },

    async stageProgressByBuilding(projectId: string): Promise<Map<string, number>> {
      const rows = await db("project_phases")
        .where({ project_id: projectId })
        .groupBy("building_id")
        .select("building_id")
        .avg<{ building_id: string; avg: string | null }[]>({ avg: "progress_percent" });
      const map = new Map<string, number>();
      for (const row of rows) {
        map.set(row.building_id, Math.round(Number(row.avg ?? 0)));
      }
      return map;
    },

    async nextSortOrder(projectId: string): Promise<number> {
      const row = await db("buildings")
        .where({ project_id: projectId, kind: "real" })
        .max<{ max: number | null }[]>("sort_order as max")
        .first();
      return (row?.max ?? -1) + 1;
    },

    async create(record: NewBuildingRecord): Promise<BuildingRow> {
      const [row] = await db("buildings").insert(record).returning(COLUMNS as unknown as string[]);
      if (!row) throw new Error("Failed to insert building");
      return row as BuildingRow;
    },

    async update(id: string, patch: BuildingUpdatePatch): Promise<BuildingRow | undefined> {
      const [row] = await db("buildings")
        .where({ id, kind: "real" })
        .update({ ...patch, updated_at: db.fn.now() })
        .returning(COLUMNS as unknown as string[]);
      return row as BuildingRow | undefined;
    },

    async remove(id: string): Promise<void> {
      await db("buildings").where({ id, kind: "real" }).del();
    },

    async reorder(projectId: string, orderedIds: string[]): Promise<void> {
      await db.transaction(async (trx) => {
        for (let i = 0; i < orderedIds.length; i += 1) {
          await trx("buildings")
            .where({ id: orderedIds[i], project_id: projectId, kind: "real" })
            .update({ sort_order: i });
        }
      });
    },

    async cloneStages(
      projectId: string,
      fromBuildingId: string,
      toBuildingId: string,
      makeId: () => string,
    ): Promise<number> {
      return db.transaction(async (trx) => {
        const source = await trx("project_phases")
          .where({ project_id: projectId, building_id: fromBuildingId })
          .orderBy("sort_order", "asc");
        if (source.length === 0) return 0;
        const cloned = source.map((row) => ({
          id: makeId(),
          project_id: projectId,
          building_id: toBuildingId,
          name: row.name,
          status: row.status,
          date_range: row.date_range,
          start_date: row.start_date,
          end_date: row.end_date,
          progress_percent: 0,
          sort_order: row.sort_order,
        }));
        await trx("project_phases").insert(cloned);
        return cloned.length;
      });
    },
  };
}

export type BuildingsRepository = ReturnType<typeof buildingsRepository>;
