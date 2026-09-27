import type { Knex } from "knex";
import type { AppliedResult, ChangeSetRow, ChangeSetStatus } from "./types.ts";

export type PreconAssistRepository = ReturnType<typeof preconAssistRepository>;

const ORIGIN_TABLES = {
  boq_row: "precon_boq_rows",
  programme_task: "precon_programme_tasks",
} as const;

export function preconAssistRepository(db: Knex) {
  // `origin` columns land with the take-off review workstream; until they are
  // migrated in, stamping is a no-op rather than a failed apply.
  const originColumnCache = new Map<string, Promise<boolean>>();
  const hasOriginColumn = (table: string) => {
    let cached = originColumnCache.get(table);
    if (!cached) {
      cached = db.schema.hasColumn(table, "origin").catch(() => false);
      originColumnCache.set(table, cached);
    }
    return cached;
  };

  return {
    insert: async (row: Omit<ChangeSetRow, "created_at" | "applied_at" | "applied_result">) => {
      const [inserted] = await db<ChangeSetRow>("precon_change_sets")
        .insert({
          ...row,
          plan_json: JSON.stringify(row.plan_json) as never,
          changes: JSON.stringify(row.changes) as never,
        })
        .returning("*");
      return inserted!;
    },
    byId: (id: string) => db<ChangeSetRow>("precon_change_sets").where({ id }).first(),
    listForSession: (sessionId: string, limit = 20) =>
      db<ChangeSetRow>("precon_change_sets").where({ session_id: sessionId }).orderBy("created_at", "desc").limit(limit),
    setStatus: (id: string, status: ChangeSetStatus, result: AppliedResult | null) =>
      db<ChangeSetRow>("precon_change_sets")
        .where({ id })
        .update({
          status,
          applied_result: result === null ? null : (JSON.stringify(result) as never),
          ...(status === "applied" ? { applied_at: db.fn.now() } : {}),
        }),
    stampOrigin: async (entity: keyof typeof ORIGIN_TABLES, ids: string[], origin: string) => {
      if (ids.length === 0) return;
      const table = ORIGIN_TABLES[entity];
      if (!(await hasOriginColumn(table))) return;
      await db(table).whereIn("id", ids).update({ origin });
    },
  };
}
