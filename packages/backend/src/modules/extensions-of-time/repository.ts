import type { Knex } from "knex";
import type { EotClaimPatch, EotClaimRow, NewEotClaimRecord } from "./types.ts";

/** A delay row joined to its activity, as a claim needs to see it. */
export interface ClaimableDelayRow {
  id: string;
  activity_id: string;
  activity_name: string;
  reason_code: string;
  days_lost: number;
  culpability: string;
  eot_claimable: boolean;
  started_at: Date | string;
}

export function eotRepository(db: Knex) {
  return {
    listByProject(projectId: string): Promise<EotClaimRow[]> {
      return db<EotClaimRow>("extension_of_time_claims")
        .where({ project_id: projectId })
        .orderBy("number", "desc");
    },

    findById(id: string): Promise<EotClaimRow | undefined> {
      return db<EotClaimRow>("extension_of_time_claims").where({ id }).first();
    },

    async nextNumber(projectId: string): Promise<number> {
      const row = await db("extension_of_time_claims")
        .where({ project_id: projectId })
        .max<{ max: number | null }[]>("number as max")
        .first();
      return (row?.max ?? 0) + 1;
    },

    async insert(record: NewEotClaimRecord): Promise<EotClaimRow> {
      const [row] = await db("extension_of_time_claims").insert(record).returning<EotClaimRow[]>("*");
      if (!row) throw new Error("Failed to insert extension of time claim");
      return row;
    },

    async update(id: string, patch: EotClaimPatch): Promise<EotClaimRow | undefined> {
      const [row] = await db("extension_of_time_claims")
        .where({ id })
        .update({ ...patch, updated_at: new Date().toISOString() })
        .returning<EotClaimRow[]>("*");
      return row;
    },

    /** The cited delays, with the culpability that decides whether they qualify. */
    delaysByIds(projectId: string, ids: string[]): Promise<ClaimableDelayRow[]> {
      if (ids.length === 0) return Promise.resolve([]);
      return db("activity_delays as d")
        .join("activities as a", "a.id", "d.activity_id")
        .where("a.project_id", projectId)
        .whereIn("d.id", ids)
        .select<ClaimableDelayRow[]>(
          "d.id",
          "d.activity_id",
          "a.name as activity_name",
          "d.reason_code",
          "d.days_lost",
          "d.culpability",
          "d.eot_claimable",
          "d.started_at",
        );
    },

    /** Days awarded on approved claims and days sitting in submitted ones. */
    async position(projectId: string): Promise<{ approved: number; pending: number; count: number }> {
      const rows = await db("extension_of_time_claims")
        .where({ project_id: projectId })
        .select<Array<{ status: string; days_claimed: number; days_awarded: number | null }>>(
          "status",
          "days_claimed",
          "days_awarded",
        );
      let approved = 0;
      let pending = 0;
      for (const row of rows) {
        if (row.status === "Approved") approved += Number(row.days_awarded ?? 0);
        else if (row.status === "Submitted") pending += Number(row.days_claimed ?? 0);
      }
      return { approved, pending, count: rows.length };
    },

    projectDates(
      projectId: string,
    ): Promise<{ completion_date: string | null; revised_completion_date: string | null } | undefined> {
      return db("projects")
        .where({ id: projectId })
        .select("completion_date", "revised_completion_date")
        .first();
    },

    async setRevisedCompletion(projectId: string, date: string | null): Promise<void> {
      await db("projects")
        .where({ id: projectId })
        .update({ revised_completion_date: date, updated_at: new Date().toISOString() });
    },
  };
}

export type EotRepository = ReturnType<typeof eotRepository>;
