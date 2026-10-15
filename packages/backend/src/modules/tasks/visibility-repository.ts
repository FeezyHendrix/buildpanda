import type { Knex } from "knex";

/** The same predicate protects boards, deep links, attached files and AI reads. */
export function applyTaskVisibility(query: Knex.QueryBuilder, db: Knex, userId: string | null | undefined, alias = "t") {
  if (userId === null) return query.whereRaw("false");
  if (userId !== undefined) query.where((related) => related.where(`${alias}.created_by_id`, userId)
    .orWhereIn(`${alias}.id`, db("task_assignees").where("assignee_id", userId).select("task_id")));
  return query;
}

export function taskVisibilityRepository(db: Knex) {
  return {
    async visibleIds(projectId: string, ids: readonly string[], userId?: string): Promise<string[]> {
      if (!ids.length) return [];
      const rows = await applyTaskVisibility(db("tasks as t").where("t.project_id", projectId).whereIn("t.id", ids), db, userId)
        .select<{ id: string }[]>("t.id");
      return rows.map((row) => row.id);
    },
  };
}

export type TaskVisibilityRepository = ReturnType<typeof taskVisibilityRepository>;
