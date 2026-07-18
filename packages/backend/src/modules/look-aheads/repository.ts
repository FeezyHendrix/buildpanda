import type { Knex } from "knex";
import type { LookAheadActivityRow, LookAheadRow, LookAheadStatus } from "./types.ts";

export interface NewLookAheadRecord {
  id: string;
  project_id: string;
  building_id: string;
  name: string;
  description: string | null;
  status: LookAheadStatus;
  start_date: string;
  end_date: string;
  total_workers: number | null;
  created_by_id: string | null;
}

export type LookAheadPatch = Partial<
  Omit<NewLookAheadRecord, "id" | "project_id" | "created_by_id">
>;

export function lookAheadsRepository(db: Knex) {
  return {
    listByProject(projectId: string, status?: LookAheadStatus, buildingId?: string): Promise<LookAheadRow[]> {
      const query = db<LookAheadRow>("look_aheads").where({ project_id: projectId });
      if (status) query.andWhere({ status });
      if (buildingId) query.andWhere({ building_id: buildingId });
      return query.orderBy("start_date", "desc");
    },

    findById(id: string): Promise<LookAheadRow | undefined> {
      return db<LookAheadRow>("look_aheads").where({ id }).first();
    },

    async insert(record: NewLookAheadRecord): Promise<LookAheadRow> {
      const rows = await db<LookAheadRow>("look_aheads").insert(record).returning("*");
      return rows[0]!;
    },

    async update(id: string, patch: LookAheadPatch): Promise<LookAheadRow | undefined> {
      const updated = await db("look_aheads")
        .where({ id })
        .update({ ...patch, updated_at: new Date() });
      if (!updated) return undefined;
      return db<LookAheadRow>("look_aheads").where({ id }).first();
    },

    async delete(id: string): Promise<void> {
      await db("look_aheads").where({ id }).del();
    },

    /** Activity summaries for a set of look-aheads, joined with `activities`. */
    activitiesFor(lookAheadIds: string[]): Promise<LookAheadActivityRow[]> {
      if (lookAheadIds.length === 0) return Promise.resolve([]);
  return db("look_ahead_activities as la")
        .join("activities as a", "a.id", "la.activity_id")
        .whereIn("la.look_ahead_id", lookAheadIds)
        .orderBy("a.planned_start_at", "asc")
        .select(
          "la.look_ahead_id",
          "la.activity_id",
          "a.building_id",
          "a.name",
          "a.status",
          "a.planned_start_at",
          "a.planned_end_at",
          "a.worker_count_planned",
        );
    },

    activitiesByIds(activityIds: string[]): Promise<{ id: string; project_id: string; building_id: string }[]> {
      if (activityIds.length === 0) return Promise.resolve([]);
      return db("activities").whereIn("id", activityIds).select("id", "project_id", "building_id");
    },

    async setActivities(lookAheadId: string, activityIds: string[]): Promise<void> {
      await db.transaction(async (trx) => {
        await trx("look_ahead_activities").where({ look_ahead_id: lookAheadId }).del();
        if (activityIds.length === 0) return;
        await trx("look_ahead_activities").insert(
          activityIds.map((activityId) => ({ look_ahead_id: lookAheadId, activity_id: activityId })),
        );
      });
    },

    async assignActivities(lookAheadId: string, activityIds: string[]): Promise<void> {
      if (activityIds.length === 0) return;
      await db("look_ahead_activities")
        .insert(activityIds.map((activityId) => ({ look_ahead_id: lookAheadId, activity_id: activityId })))
        .onConflict(["look_ahead_id", "activity_id"])
        .ignore();
    },

    async unassignActivities(lookAheadId: string, activityIds: string[]): Promise<void> {
      if (activityIds.length === 0) return;
      await db("look_ahead_activities")
        .where({ look_ahead_id: lookAheadId })
        .whereIn("activity_id", activityIds)
        .del();
    },
  };
}

export type LookAheadsRepository = ReturnType<typeof lookAheadsRepository>;
