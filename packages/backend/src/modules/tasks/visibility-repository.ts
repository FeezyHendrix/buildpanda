import type { Knex } from "knex";

/**
 * Roster entries have no user_id; a verified-email match scoped through
 * task_assignees is the only link between "assigned to this team member" and
 * the signed-in person it names. Without it, a task a PM assigns from the
 * roster is invisible to the very person it was assigned to.
 */
function callerTeamMemberIds(db: Knex, userId: string) {
  return db("team_members as tm")
    .join("user as u", db.raw("lower(u.email) = lower(tm.email)"))
    .where("u.id", userId)
    .whereNot("tm.status", "removed")
    .select("tm.id");
}

/** The same predicate protects boards, deep links, attached files and AI reads. */
export function applyTaskVisibility(query: Knex.QueryBuilder, db: Knex, userId: string | null | undefined, alias = "t") {
  if (userId === null) return query.whereRaw("false");
  if (userId !== undefined) query.where((related) => related.where(`${alias}.created_by_id`, userId)
    .orWhereIn(`${alias}.id`, db("task_assignees").where("assignee_id", userId).select("task_id"))
    .orWhereIn(`${alias}.id`, db("task_assignees")
      .whereIn("assignee_team_member_id", callerTeamMemberIds(db, userId))
      .select("task_id")));
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

    async callerTeamMemberIds(projectId: string, userId: string): Promise<string[]> {
      const rows = await callerTeamMemberIds(db, userId)
        .where("tm.project_id", projectId)
        .select<{ id: string }[]>("tm.id");
      return rows.map((row) => row.id);
    },
  };
}

export type TaskVisibilityRepository = ReturnType<typeof taskVisibilityRepository>;
