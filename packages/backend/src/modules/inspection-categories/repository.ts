import type { Knex } from "knex";
import type { CategoryAudience, InspectionCategoryRow } from "./types.ts";

const TABLE = "inspection_categories";

export function inspectionCategoriesRepository(db: Knex) {
  /**
   * Every project sees BuildPanda's global catalogue plus its own workspace's
   * additions plus anything added on the project itself — the catalogue is the
   * service we offer, the rest is the customer extending it. BuildPanda staff
   * working on the catalogue itself see only the global rows.
   */
  function scoped(audience: CategoryAudience) {
    return db<InspectionCategoryRow>(TABLE).where((builder) => {
      if ("global" in audience) {
        builder.whereNull("organization_id").whereNull("project_id");
        return;
      }
      builder
        .where({ project_id: audience.projectId })
        .orWhere((global) => global.whereNull("organization_id").whereNull("project_id"));
      if (audience.organizationId) builder.orWhere({ organization_id: audience.organizationId });
    });
  }

  return {
    list: (audience: CategoryAudience, includeArchived: boolean) =>
      scoped(audience)
        .modify((query) => {
          if (!includeArchived) query.where({ active: true });
        })
        .orderBy([{ column: "sort_order" }, { column: "name" }]),

    byId: (audience: CategoryAudience, id: string) => scoped(audience).andWhere({ id }).first(),

    byName: (audience: CategoryAudience, name: string) =>
      scoped(audience).andWhereRaw("lower(name) = lower(?)", [name]).first(),

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
