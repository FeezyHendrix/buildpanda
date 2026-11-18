import type { Knex } from "knex";
import type { BuildingPhaseRow, NewBuildingPhaseRecord } from "./types.ts";

export function buildingPhasesRepository(db: Knex) {
  return {
    listByProject(projectId: string, buildingId?: string): Promise<BuildingPhaseRow[]> {
      const where: Record<string, string> = { project_id: projectId };
      if (buildingId) where.building_id = buildingId;
      return db<BuildingPhaseRow>("building_phases")
        .where(where)
        .orderBy([
          { column: "sort_order", order: "asc" },
          { column: "created_at", order: "asc" },
        ]);
    },

    findById(id: string): Promise<BuildingPhaseRow | undefined> {
      return db<BuildingPhaseRow>("building_phases").where({ id }).first();
    },

    async nextSortOrder(projectId: string, buildingId: string): Promise<number> {
      const row = await db("building_phases")
        .where({ project_id: projectId, building_id: buildingId })
        .max<{ max: number | null }[]>("sort_order as max")
        .first();
      return (row?.max ?? -1) + 1;
    },

    async create(record: NewBuildingPhaseRecord): Promise<BuildingPhaseRow> {
      const [row] = await db("building_phases").insert(record).returning("*");
      if (!row) throw new Error("Failed to insert building phase");
      return row as BuildingPhaseRow;
    },

    async rename(id: string, name: string): Promise<BuildingPhaseRow | undefined> {
      const [row] = await db("building_phases")
        .where({ id })
        .update({ name, updated_at: db.fn.now() })
        .returning("*");
      return row as BuildingPhaseRow | undefined;
    },

    async remove(id: string): Promise<void> {
      await db("building_phases").where({ id }).del();
    },
  };
}

export type BuildingPhasesRepository = ReturnType<typeof buildingPhasesRepository>;
