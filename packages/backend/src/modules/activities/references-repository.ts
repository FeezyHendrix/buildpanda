import type { Knex } from "knex";
import type {
  ActivityDelayReferenceRow,
  ActivityLookAheadReferenceRow,
} from "./references-types.ts";

export function activityReferencesRepository(db: Knex) {
  return {
    activityProjectId(activityId: string): Promise<{ project_id: string } | undefined> {
      return db("activities")
        .where({ id: activityId })
        .first<{ project_id: string } | undefined>("project_id");
    },

    lookAheadsForActivity(activityId: string): Promise<ActivityLookAheadReferenceRow[]> {
      return db("look_ahead_activities as la")
        .join("look_aheads as l", "l.id", "la.look_ahead_id")
        .where("la.activity_id", activityId)
        .orderBy("l.start_date", "asc")
        .select<ActivityLookAheadReferenceRow[]>(
          "l.id as id",
          "l.name as name",
          "l.status as status",
          "l.start_date as start_date",
          "l.end_date as end_date",
        );
    },

    delaysForActivity(activityId: string): Promise<ActivityDelayReferenceRow[]> {
      return db("activity_delays")
        .where({ activity_id: activityId })
        .orderBy("started_at", "asc")
        .select<ActivityDelayReferenceRow[]>("id", "reason_code", "started_at", "resolved_at");
    },
  };
}

export type ActivityReferencesRepository = ReturnType<typeof activityReferencesRepository>;
