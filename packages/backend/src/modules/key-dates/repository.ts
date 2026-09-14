import type { Knex } from "knex";
import type { KeyDatePatch, KeyDateRow, NewKeyDateRecord } from "./types.ts";

export function keyDatesRepository(db: Knex) {
  return {
    listByProject(projectId: string, buildingId?: string): Promise<KeyDateRow[]> {
      const where: Record<string, string> = { project_id: projectId };
      if (buildingId) where.building_id = buildingId;
      return db<KeyDateRow>("key_dates")
        .where(where)
        .orderBy([
          { column: "target_date", order: "asc" },
          { column: "sort_order", order: "asc" },
        ]);
    },

    findById(id: string): Promise<KeyDateRow | undefined> {
      return db<KeyDateRow>("key_dates").where({ id }).first();
    },

    /** Every non-contractual key date anchored to one of these activities. */
    linkedToActivities(activityIds: string[]): Promise<KeyDateRow[]> {
      if (activityIds.length === 0) return Promise.resolve([]);
      return db<KeyDateRow>("key_dates")
        .whereIn("linked_activity_id", activityIds)
        .where({ is_contractual: false });
    },

    /** The contract dates an awarded extension of time moves. */
    contractualForProject(projectId: string): Promise<KeyDateRow[]> {
      return db<KeyDateRow>("key_dates")
        .where({ project_id: projectId, is_contractual: true })
        .whereNotNull("target_date");
    },

    async insert(record: NewKeyDateRecord): Promise<KeyDateRow> {
      const [row] = await db("key_dates").insert(record).returning<KeyDateRow[]>("*");
      if (!row) throw new Error("Failed to insert key date");
      return row;
    },

    async update(id: string, patch: KeyDatePatch): Promise<KeyDateRow | undefined> {
      const [row] = await db("key_dates")
        .where({ id })
        .update({ ...patch, updated_at: new Date().toISOString() })
        .returning<KeyDateRow[]>("*");
      return row;
    },

    async remove(id: string, projectId: string): Promise<void> {
      await db("key_dates").where({ id, project_id: projectId }).del();
    },

    activityBelongsToProject(
      activityId: string,
      projectId: string,
    ): Promise<{ id: string } | undefined> {
      return db("activities").where({ id: activityId, project_id: projectId }).select("id").first();
    },

    projectCalendar(
      projectId: string,
    ): Promise<{ working_days: unknown; holidays: unknown } | undefined> {
      return db("projects").where({ id: projectId }).select("working_days", "holidays").first();
    },
  };
}

export type KeyDatesRepository = ReturnType<typeof keyDatesRepository>;
