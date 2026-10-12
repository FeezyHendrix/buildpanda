import type { Knex } from "knex";
import type { DailyLogTemplateRow, TemplateOwner } from "./types.ts";

const TABLE = "daily_log_templates";

/** pg would send a JS array as a Postgres array, not JSON — stringify for jsonb. */
function serialise(patch: Partial<DailyLogTemplateRow>): Record<string, unknown> {
  return patch.fields === undefined ? patch : { ...patch, fields: JSON.stringify(patch.fields) };
}

export function dailyLogTemplatesRepository(db: Knex) {
  /** A project fills its organisation's forms plus any form made for the job itself. */
  function scoped(owner: TemplateOwner) {
    return db<DailyLogTemplateRow>(TABLE).where((builder) => {
      builder.where({ project_id: owner.projectId });
      if (owner.organizationId) builder.orWhere({ organization_id: owner.organizationId });
    });
  }

  return {
    list: (owner: TemplateOwner, includeArchived: boolean): Promise<DailyLogTemplateRow[]> =>
      scoped(owner)
        .modify((query) => {
          if (!includeArchived) query.where({ active: true });
        })
        .orderBy([{ column: "name" }]),

    byId: (owner: TemplateOwner, id: string) => scoped(owner).andWhere({ id }).first(),

    /** The same visibility as `scoped`, resolved from the project alone. */
    byIdForProject: (projectId: string, id: string) =>
      db<DailyLogTemplateRow>(TABLE)
        .where({ id })
        .andWhere((builder) => {
          builder
            .where({ project_id: projectId })
            .orWhereIn("organization_id", db("projects").select("organization_id").where({ id: projectId }));
        })
        .first(),

    /** Names are unique within one list (org or project), matching the DB indexes. */
    byNameInList: (list: Pick<DailyLogTemplateRow, "organization_id" | "project_id">, name: string) =>
      db<DailyLogTemplateRow>(TABLE)
        .where(list.organization_id ? { organization_id: list.organization_id } : { project_id: list.project_id })
        .andWhereRaw("lower(name) = lower(?)", [name])
        .first(),

    insert: (row: DailyLogTemplateRow) => db(TABLE).insert(serialise(row)),

    update: (id: string, patch: Partial<DailyLogTemplateRow>) =>
      db(TABLE).where({ id }).update({ ...serialise(patch), updated_at: new Date() }),

    remove: (id: string) => db(TABLE).where({ id }).delete(),

    /** One default per list: setting a new one clears the rest of that list. */
    clearDefault: (list: Pick<DailyLogTemplateRow, "organization_id" | "project_id">) =>
      db(TABLE)
        .where(list.organization_id ? { organization_id: list.organization_id } : { project_id: list.project_id })
        .andWhere({ is_default: true })
        .update({ is_default: false, updated_at: new Date() }),

    usageCounts: async (ids: string[]): Promise<Map<string, number>> => {
      if (ids.length === 0) return new Map();
      const rows = await db("daily_log_entries")
        .whereIn("template_id", ids)
        .groupBy("template_id")
        .select("template_id")
        .count<{ template_id: string; count: string }[]>("id as count");
      return new Map(rows.map((row) => [row.template_id, Number(row.count)]));
    },
  };
}

export type DailyLogTemplatesRepository = ReturnType<typeof dailyLogTemplatesRepository>;
