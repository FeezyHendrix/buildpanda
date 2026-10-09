import type { Knex } from "knex";
import type { PreconProgrammeTaskRow, RowStatus } from "./types.ts";

export type PreconProgrammeRepository = ReturnType<typeof preconProgrammeRepository>;

export function preconProgrammeRepository(db: Knex) {
  return {
    replaceProgrammeTasks: async (
      sessionId: string,
      rows: Omit<PreconProgrammeTaskRow, "created_at" | "updated_at">[],
    ) => {
      await db.transaction(async (trx) => {
        // Null the self-references first: the rows reference each other, so a
        // plain delete trips the parent_task_id foreign key.
        await trx("precon_programme_tasks").where({ session_id: sessionId }).update({ parent_task_id: null });
        await trx("precon_programme_tasks").where({ session_id: sessionId }).delete();
        for (let i = 0; i < rows.length; i += 200) {
          await trx<PreconProgrammeTaskRow>("precon_programme_tasks").insert(
            rows.slice(i, i + 200).map((r) => ({
              ...r,
              predecessors: JSON.stringify(r.predecessors) as never,
            })),
          );
        }
      });
    },
    programmeTasksBySession: (sessionId: string) =>
      db<PreconProgrammeTaskRow>("precon_programme_tasks")
        .where({ session_id: sessionId })
        .orderBy("sort", "asc"),
    programmeTaskById: (id: string) =>
      db<PreconProgrammeTaskRow>("precon_programme_tasks").where({ id }).first(),
    insertProgrammeTask: async (row: Omit<PreconProgrammeTaskRow, "created_at" | "updated_at">) => {
      const [inserted] = await db<PreconProgrammeTaskRow>("precon_programme_tasks")
        .insert({ ...row, predecessors: JSON.stringify(row.predecessors) as never })
        .returning("*");
      return inserted!;
    },
    deleteProgrammeTask: (id: string) => db("precon_programme_tasks").where({ id }).delete(),
    // Derived fields (parent, sort, float, critical) change as a consequence of
    // another task's edit, so they bypass the optimistic version check.
    updateProgrammeTaskDerived: (
      id: string,
      patch: Partial<
        Pick<
          PreconProgrammeTaskRow,
          "parent_task_id" | "sort" | "total_float_days" | "is_critical" | "predecessors" | "outline_level"
        >
      >,
    ) =>
      db<PreconProgrammeTaskRow>("precon_programme_tasks")
        .where({ id })
        .update({
          ...patch,
          predecessors: patch.predecessors === undefined ? undefined : (JSON.stringify(patch.predecessors) as never),
        }),
    updateProgrammeTaskVersioned: async (
      id: string,
      version: number,
      patch: Partial<
        Pick<
          PreconProgrammeTaskRow,
          | "name"
          | "duration_days"
          | "predecessors"
          | "is_milestone"
          | "basis"
          | "status"
          | "verified_by"
          | "verified_at"
          | "outline_level"
          | "origin"
        >
      >,
    ): Promise<PreconProgrammeTaskRow | null> => {
      const rows = await db<PreconProgrammeTaskRow>("precon_programme_tasks")
        .where({ id, version })
        .update(
          {
            ...patch,
            predecessors:
              patch.predecessors === undefined ? undefined : (JSON.stringify(patch.predecessors) as never),
            version: db.raw("version + 1") as never,
            updated_at: db.fn.now(),
          },
          "*",
        );
      return (rows as PreconProgrammeTaskRow[])[0] ?? null;
    },
    programmeStatusCounts: async (sessionId: string): Promise<{ status: RowStatus | null; count: number }[]> => {
      const rows = (await db("precon_programme_tasks")
        .where({ session_id: sessionId })
        .groupBy("status")
        .select("status")
        .count("* as count")) as unknown as { status: RowStatus | null; count: string }[];
      return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
    },
    setProgrammeStartDate: (sessionId: string, startDate: string) =>
      db("precon_sessions").where({ id: sessionId }).update({ programme_start_date: startDate, updated_at: db.fn.now() }),
  };
}
