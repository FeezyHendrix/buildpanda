import type { Knex } from "knex";
import type {
  ActivityDelayRow,
  ActivityEventRow,
  ActivityRow,
  ActivityStatus,
  Culpability,
  Currency,
  DelayReasonRow,
} from "./types.ts";

export interface NewActivityRecord {
  id: string;
  project_id: string;
  building_id: string;
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
  baseline_start_at?: string | null;
  baseline_end_at?: string | null;
}

export interface NewActivityEventRecord {
  id: string;
  project_id: string;
  activity_id: string;
  kind: string;
  summary: string;
  days_delta: number;
  delay_id: string | null;
  actor_id: string | null;
}

export interface NewDelayRecord {
  id: string;
  activity_id: string;
  reason_code: string;
  description: string | null;
  description_html: string | null;
  started_at: string;
  ended_at: string | null;
  days_lost: number;
  culpability: Culpability;
  eot_claimable: boolean;
  linked_rfi_id: string | null;
  linked_change_request_id: string | null;
  linked_material_order_id: string | null;
  applied_shift_days: number;
  cost_impact: number;
  currency: Currency;
  prevention_notes: string | null;
  recorded_by_id: string | null;
}

export interface DelayResolvePatch {
  resolved_at?: string;
  resolved_by_id?: string | null;
  ended_at?: string | null;
  days_lost?: number;
  culpability?: Culpability;
  eot_claimable?: boolean;
  linked_rfi_id?: string | null;
  linked_change_request_id?: string | null;
  linked_material_order_id?: string | null;
  applied_shift_days?: number;
  prevention_notes?: string | null;
}

export function activitiesRepository(db: Knex) {
  return {
    listByProject(projectId: string, buildingId?: string): Promise<ActivityRow[]> {
      const where: Record<string, string> = { "activities.project_id": projectId };
      if (buildingId) where["activities.building_id"] = buildingId;
      return db<ActivityRow>("activities")
        .leftJoin("user as asg", "asg.id", "activities.assignee_id")
        .where(where)
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
      return db<ActivityDelayRow>("activity_delays as d")
        .leftJoin("user as u", "u.id", "d.recorded_by_id")
        .select("d.*", "u.name as recorded_by_name")
        .whereIn("d.activity_id", activityIds)
        .orderBy([
          { column: "d.activity_id", order: "asc" },
          { column: "d.started_at", order: "desc" },
        ]);
    },

    delaysForActivity(activityId: string): Promise<ActivityDelayRow[]> {
      return db<ActivityDelayRow>("activity_delays as d")
        .leftJoin("user as u", "u.id", "d.recorded_by_id")
        .select("d.*", "u.name as recorded_by_name")
        .where({ "d.activity_id": activityId })
        .orderBy("d.started_at", "desc");
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

    phaseNamesForProject(projectId: string): Promise<{ id: string; name: string; building_id: string }[]> {
      return db("project_phases").where({ project_id: projectId }).select("id", "name", "building_id");
    },

    phaseById(id: string): Promise<{ id: string; project_id: string; building_id: string } | undefined> {
      return db("project_phases").where({ id }).select("id", "project_id", "building_id").first();
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

    /** Every delay on the project with its activity name — the delay register. */
    delaysForProject(projectId: string): Promise<Array<ActivityDelayRow & { activity_name: string }>> {
      return db<ActivityDelayRow>("activity_delays as d")
        .join("activities as a", "a.id", "d.activity_id")
        .where("a.project_id", projectId)
        .orderBy("d.started_at", "desc")
        .select("d.*", "a.name as activity_name") as unknown as Promise<
        Array<ActivityDelayRow & { activity_name: string }>
      >;
    },

    delaysByIds(ids: string[]): Promise<ActivityDelayRow[]> {
      if (ids.length === 0) return Promise.resolve([]);
      return db<ActivityDelayRow>("activity_delays").whereIn("id", ids);
    },

    async recordEvent(record: NewActivityEventRecord): Promise<void> {
      await db("activity_events").insert(record);
    },

    eventsForActivity(activityId: string): Promise<ActivityEventRow[]> {
      return db<ActivityEventRow>("activity_events")
        .where({ activity_id: activityId })
        .orderBy("created_at", "desc")
        .limit(200);
    },

    /** How many activities still hang off a stage — what blocks deleting it. */
    async countByPhase(phaseId: string): Promise<number> {
      const row = await db("activities")
        .where({ phase_id: phaseId })
        .count<{ count: string }[]>("id as count")
        .first();
      return Number(row?.count ?? 0);
    },

    /** The project's working calendar; the cascade and every duration read it. */
    projectCalendar(
      projectId: string,
    ): Promise<{ working_days: unknown; holidays: unknown } | undefined> {
      return db("projects")
        .where({ id: projectId })
        .select("working_days", "holidays")
        .first();
    },
  };
}

export type ActivitiesRepository = ReturnType<typeof activitiesRepository>;
