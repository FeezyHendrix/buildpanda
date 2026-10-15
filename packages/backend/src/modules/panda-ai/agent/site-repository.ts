import type { Knex } from "knex";

export function siteAgentRepository(db: Knex) {
  return {
    risks(projectId: string) {
      return db("risk_factors")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc")
        .select("id", "title", "description", "severity", "created_at");
    },

    dailyLogs(projectId: string, limit: number) {
      return db("daily_logs")
        .where({ project_id: projectId })
        .orderBy("log_date", "desc")
        .limit(limit)
        .select(
          "log_date",
          "weather_condition",
          "temperature_c",
          "workers_present",
          "workers_expected",
          "total_hours",
          "summary",
          "voided_at",
        );
    },

    dailyLogActivityHours(projectId: string, logDates: string[]) {
      return db("daily_log_activities as dla")
        .join("activities as a", "a.id", "dla.activity_id")
        .where("dla.project_id", projectId)
        .whereIn("dla.log_date", logDates)
        .orderBy("dla.log_date", "desc")
        .select("dla.log_date", "a.name as activity_name", "dla.hours_logged");
    },

    dailyLogEntries(projectId: string, logDates: string[]) {
      return db("daily_log_entries as e")
        .leftJoin("daily_log_entry_voids as v", "v.entry_id", "e.id")
        .where("e.project_id", projectId)
        .whereIn("e.log_date", logDates)
        .whereNull("v.id")
        .orderBy("e.created_at", "asc")
        .select("e.log_date", "e.author_name", "e.author_role", "e.body_text");
    },

    inspections(projectId: string) {
      return db("inspections")
        .leftJoin("user as inspector", "inspector.id", "inspections.inspector_user_id")
        .where({ project_id: projectId })
        .orderBy("inspections.scheduled_at", "desc")
        .select(
          "inspections.id",
          "inspections.title",
          "inspections.category",
          "inspections.status",
          "inspections.service_status",
          "inspections.risk_level",
          "inspections.scheduled_at",
          "inspections.outcome",
          "inspections.findings",
          "inspections.contractor_name",
          "inspections.report_issued_at",
          "inspections.inspector_name",
          "inspector.name as inspector_user_name",
        );
    },

    rfisOpen(projectId: string) {
      return db("rfis as r")
        .where("r.project_id", projectId)
        .whereNotIn("r.status", ["Answered", "Closed", "Void"])
        .orderBy("r.due_date", "asc")
        .limit(50)
        .select("r.id", "r.subject as title", "r.status", "r.priority", "r.due_date");
    },

    approvalsOpen(projectId: string) {
      return db("approvals as a")
        .leftJoin("user as u", "u.id", "a.submitted_by_id")
        // Material approvals share this table; kind + material keep them from
        // being reported to the PM as client sign-offs.
        .leftJoin("material_approval_details as md", "md.approval_id", "a.id")
        .where("a.project_id", projectId)
        .whereIn("a.status", ["Pending", "Resubmit"])
        .orderBy("a.due_date", "asc")
        .limit(50)
        .select(
          "a.id",
          "a.kind",
          "a.title",
          "a.category",
          "a.status",
          "a.due_date",
          "u.name as submittedBy",
          "md.material_name as materialName",
          "md.quantity as materialQuantity",
          "md.unit as materialUnit",
          "md.supplier as materialSupplier",
          "md.needed_by as materialNeededBy",
        );
    },

    changeRequests(projectId: string) {
      return db("change_requests as cr")
        .leftJoin("user as u", "u.id", "cr.submitted_by_id")
        .where("cr.project_id", projectId)
        .orderBy("cr.created_at", "desc")
        .limit(50)
        .select(
          "cr.id",
          "cr.title",
          "cr.status",
          "cr.cost_impact",
          "cr.time_impact_days",
          "cr.currency",
          "cr.reason",
          "cr.decided_at",
          "u.name as submittedBy",
        );
    },

    permits(projectId: string) {
      return db("permits")
        .where({ project_id: projectId })
        .orderBy("expiry_date", "asc")
        .limit(50)
        .select(
          "id",
          "title",
          "authority",
          "reference_no",
          "status",
          "applied_date",
          "approved_date",
          "expiry_date",
        );
    },

    selections(projectId: string) {
      // One query: selections with their chosen option joined in.
      return db("project_selections as s")
        .leftJoin("project_selection_options as o", "o.id", "s.chosen_option_id")
        .where("s.project_id", projectId)
        .orderBy("s.created_at", "desc")
        .limit(100)
        .select(
          "s.id",
          "s.title",
          "s.category",
          "s.status",
          "s.allowance_amount",
          "s.currency",
          "s.due_date",
          "s.decided_at",
          "s.change_request_id",
          "o.name as chosen_option_name",
          "o.price as chosen_option_price",
        );
    },
  };
}
