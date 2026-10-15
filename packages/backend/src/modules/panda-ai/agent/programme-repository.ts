import type { Knex } from "knex";

export function programmeAgentRepository(db: Knex) {
  return {
    projectInfo(projectId: string) {
      return db("projects")
        .where({ id: projectId })
        .first<{
          id: string;
          name: string;
          status: string;
          currency: string;
          progress_percent: number;
          budget_total: number;
          budget_used: number;
          address: string;
          setup: unknown;
        }>(
          "id",
          "name",
          "status",
          "currency",
          "progress_percent",
          "budget_total",
          "budget_used",
          "address",
          "setup",
        );
    },

    phases(projectId: string) {
      return db("project_phases")
        .where({ project_id: projectId })
        .orderBy("sort_order", "asc")
        .select("id", "name", "status", "date_range", "sort_order");
    },

    scheduleOfValues(projectId: string) {
      return db("stage_schedule_of_values as sov")
        .leftJoin("project_phases as p", "p.id", "sov.stage_id")
        .where("sov.project_id", projectId)
        .orderBy([
          { column: "p.sort_order", order: "asc" },
          { column: "sov.sort_order", order: "asc" },
        ])
        .select(
          "p.name as stage_name",
          "p.value as stage_value",
          "sov.period",
          "sov.percent",
          "sov.amount",
          "sov.billed",
        );
    },

    buildings(projectId: string) {
      return db("buildings")
        .where({ project_id: projectId, kind: "real" })
        .orderBy("sort_order", "asc")
        .select("id", "name", "code", "status", "progress_percent");
    },

    activities(projectId: string) {
      return db("activities")
        .where({ project_id: projectId })
        .orderBy("planned_start_at", "asc")
        .select(
          "id",
          "name",
          "phase_id",
          "status",
          "planned_start_at",
          "planned_end_at",
          "percent_complete",
          "is_milestone",
          "wbs_code",
          "duration_days",
          "predecessors",
        );
    },

    delays(projectId: string) {
      return db("activity_delays as d")
        .join("activities as a", "a.id", "d.activity_id")
        .where("a.project_id", projectId)
        .orderBy("d.started_at", "desc")
        .select(
          "d.id",
          "a.name as activityName",
          "d.reason_code",
          "d.cost_impact",
          "d.started_at",
          "d.resolved_at",
          "d.description",
        );
    },

    scheduleDates(projectId: string) {
      return db("projects")
        .where({ id: projectId })
        .first<{
          start_date: string | null;
          completion_date: string | null;
          revised_completion_date: string | null;
        }>("start_date", "completion_date", "revised_completion_date");
    },

    delaysWithCulpability(projectId: string) {
      return db("activity_delays as d")
        .join("activities as a", "a.id", "d.activity_id")
        .where("a.project_id", projectId)
        .orderBy("d.started_at", "desc")
        .limit(200)
        .select(
          "d.id",
          "a.name as activityName",
          "d.reason_code",
          "d.days_lost",
          "d.culpability",
          "d.eot_claimable",
          "d.started_at",
          "d.ended_at",
          "d.resolved_at",
        );
    },

    eotClaims(projectId: string) {
      return db("change_requests")
        .where({ project_id: projectId, type: "eot_only" })
        .orderBy("created_at", "asc")
        .select("id", "title", "status", "time_impact_days", "days_awarded", "decided_at");
    },

    timelineShift(projectId: string) {
      return db("activities")
        .where({ project_id: projectId })
        .whereNotNull("baseline_end_at")
        .first<{ shift: string | null } | undefined>(
          db.raw("MAX(EXTRACT(EPOCH FROM (planned_end_at - baseline_end_at)) / 86400) as shift"),
        );
    },

    keyDates(projectId: string) {
      return db("key_dates")
        .where({ project_id: projectId })
        .orderBy("target_date", "asc")
        .select("id", "label", "target_date", "actual_date", "status");
    },

    programmeBaseline(projectId: string) {
      return db("activities as a")
        .leftJoin("project_phases as ph", "ph.id", "a.phase_id")
        .where("a.project_id", projectId)
        .whereNotNull("a.baseline_start_at")
        .orderBy("a.planned_start_at", "asc")
        .select(
          "a.id",
          "a.name",
          "ph.name as stage",
          "a.is_milestone",
          "a.status",
          "a.percent_complete",
          "a.baseline_start_at",
          "a.baseline_end_at",
          "a.planned_start_at",
          "a.planned_end_at",
          "a.actual_start_at",
          "a.actual_end_at",
          "a.programme_task_id",
        );
    },
  };
}
