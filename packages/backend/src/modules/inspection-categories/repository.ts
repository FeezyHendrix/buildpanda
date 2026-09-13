import type { Knex } from "knex";
import type { CategoryOwner, InspectionCategoryRow } from "./types.ts";

const TABLE = "inspection_categories";

export function inspectionCategoriesRepository(db: Knex) {
  /**
   * A project sees its organisation's list plus anything added on the project
   * itself. A project with no organisation falls back to the global seed rows.
   */
  function scoped(owner: CategoryOwner) {
    return db<InspectionCategoryRow>(TABLE).where((builder) => {
      builder.where({ project_id: owner.projectId });
      if (owner.organizationId) builder.orWhere({ organization_id: owner.organizationId });
      else builder.orWhere((global) => global.whereNull("organization_id").whereNull("project_id"));
    });
  }

  return {
    list: (owner: CategoryOwner, includeArchived: boolean) =>
      scoped(owner)
        .modify((query) => {
          if (!includeArchived) query.where({ active: true });
        })
        .orderBy([{ column: "sort_order" }, { column: "name" }]),

    byId: (owner: CategoryOwner, id: string) => scoped(owner).andWhere({ id }).first(),

    byName: (owner: CategoryOwner, name: string) =>
      scoped(owner).andWhereRaw("lower(name) = lower(?)", [name]).first(),

    insert: (row: InspectionCategoryRow) => db<InspectionCategoryRow>(TABLE).insert(row),

    update: (id: string, patch: Partial<InspectionCategoryRow>) =>
      db<InspectionCategoryRow>(TABLE).where({ id }).update({ ...patch, updated_at: new Date() }),

    remove: (id: string) => db<InspectionCategoryRow>(TABLE).where({ id }).delete(),

    /** Usage across every project, so an org category in use anywhere is protected. */
    usageCounts: async (ids: string[]): Promise<Map<string, number>> => {
      if (ids.length === 0) return new Map();
      const rows = await db("inspections")
        .whereIn("category_id", ids)
        .groupBy("category_id")
        .select("category_id")
        .count<{ category_id: string; count: string }[]>("id as count");
      return new Map(rows.map((row) => [row.category_id, Number(row.count)]));
    },

    /** Keeps the denormalised name on inspections in step with a rename. */
    renameOnInspections: (id: string, name: string) =>
      db("inspections").where({ category_id: id }).update({ category: name }),
  };
}

export type InspectionCategoriesRepository = ReturnType<typeof inspectionCategoriesRepository>;
