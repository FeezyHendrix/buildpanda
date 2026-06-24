import type { Knex } from "knex";
import type {
  ActivityDelayRow,
  ActivityRow,
  ActivityStatus,
  Currency,
  DelayReasonRow,
} from "./types.ts";

export interface NewActivityRecord {
  id: string;
  project_id: string;
  phase_id: string | null;
  name: string;
  activity_type: string;
  location: string | null;
  status: ActivityStatus;
  planned_start_at: string;
  planned_end_at: string;
  worker_count_planned: number;
  assignee_id?: string | null;
  notes: string | null;
  wbs_code?: string | null;
  outline_level?: number | null;
  parent_activity_id?: string | null;
  predecessors?: string;
  percent_complete?: number;
  duration_days?: number | null;
  baseline_start_at?: string | null;
  baseline_end_at?: string | null;
  is_milestone?: boolean;
  source?: string;
  created_by_id: string | null;
}

export interface ActivityUpdatePatch {
  name?: string;
  activity_type?: string;
  phase_id?: string | null;
  location?: string | null;
  status?: ActivityStatus;
  planned_start_at?: string;
  planned_end_at?: string;
  actual_start_at?: string | null;
  actual_end_at?: string | null;
  worker_count_planned?: number;
  assignee_id?: string | null;
  notes?: string | null;
  predecessors?: string;
  percent_complete?: number;
  is_milestone?: boolean;
}

export interface NewDelayRecord {
  id: string;
  activity_id: string;
  reason_code: string;
  description: string | null;
  description_html: string | null;
  started_at: string;
  cost_impact: number;
  currency: Currency;
  prevention_notes: string | null;
  recorded_by_id: string | null;
}

export interface DelayResolvePatch {
  resolved_at: string;
  prevention_notes?: string | null;
}

export function activitiesRepository(db: Knex) {
  return {
    listByProject(projectId: string): Promise<ActivityRow[]> {
      return db<ActivityRow>("activities")
        .leftJoin("user as asg", "asg.id", "activities.assignee_id")
        .where({ "activities.project_id": projectId })
        .orderBy("planned_start_at", "asc")
        .select("activities.*", "asg.name as assignee_name");
    },

    findById(id: string): Promise<ActivityRow | undefined> {
      return db<ActivityRow>("activities")
        .leftJoin("user as asg", "asg.id", "activities.assignee_id")
        .where({ "activities.id": id })
        .select("activities.*", "asg.name as assignee_name")
        .first();
    },

    delaysForActivities(activityIds: string[]): Promise<ActivityDelayRow[]> {
      if (activityIds.length === 0) return Promise.resolve([]);
      return db<ActivityDelayRow>("activity_delays")
        .whereIn("activity_id", activityIds)
        .orderBy([
          { column: "activity_id", order: "asc" },
          { column: "started_at", order: "desc" },
        ]);
    },

    delaysForActivity(activityId: string): Promise<ActivityDelayRow[]> {
      return db<ActivityDelayRow>("activity_delays")
        .where({ activity_id: activityId })
        .orderBy("started_at", "desc");
    },

    findDelayById(id: string): Promise<ActivityDelayRow | undefined> {
      return db<ActivityDelayRow>("activity_delays").where({ id }).first();
    },

    findReasonByCode(code: string): Promise<DelayReasonRow | undefined> {
      return db<DelayReasonRow>("delay_reasons").where({ code }).first();
    },

    reasonsByCodes(codes: string[]): Promise<DelayReasonRow[]> {
      if (codes.length === 0) return Promise.resolve([]);
      return db<DelayReasonRow>("delay_reasons").whereIn("code", codes);
    },

    listReasons(): Promise<DelayReasonRow[]> {
      return db<DelayReasonRow & { description: string }>("delay_reasons")
        .where({ is_active: true })
        .orderBy([{ column: "category" }, { column: "name" }]);
    },

    phaseNamesForProject(projectId: string): Promise<{ id: string; name: string }[]> {
      return db("project_phases").where({ project_id: projectId }).select("id", "name");
    },

    async create(record: NewActivityRecord): Promise<ActivityRow> {
      const [row] = await db("activities").insert(record).returning<ActivityRow[]>("*");
      if (!row) throw new Error("Failed to insert activity");
      return row;
    },

    async update(id: string, patch: ActivityUpdatePatch): Promise<ActivityRow | undefined> {
      const [row] = await db("activities")
        .where({ id })
        .update({ ...patch, updated_at: new Date() })
        .returning<ActivityRow[]>("*");
      return row;
    },

    async deleteActivity(id: string): Promise<void> {
      await db.transaction(async (trx) => {
        await trx("activity_delays").where({ activity_id: id }).del();
        await trx("activities").where({ id }).del();
      });
    },

    async createDelay(record: NewDelayRecord): Promise<ActivityDelayRow> {
      const [row] = await db("activity_delays").insert(record).returning<ActivityDelayRow[]>("*");
      if (!row) throw new Error("Failed to insert activity delay");
      return row;
    },

    async resolveDelay(id: string, patch: DelayResolvePatch): Promise<ActivityDelayRow | undefined> {
      const [row] = await db("activity_delays")
        .where({ id })
        .update(patch)
        .returning<ActivityDelayRow[]>("*");
      return row;
    },
  };
}

export type ActivitiesRepository = ReturnType<typeof activitiesRepository>;
