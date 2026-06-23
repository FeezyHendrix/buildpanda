import type { Knex } from "knex";

export function agentRepository(db: Knex) {
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

    risks(projectId: string) {
      return db("risk_factors")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc")
        .select("id", "title", "description", "severity", "created_at");
    },

    finances(projectId: string) {
      return db("project_finances").where({ project_id: projectId }).first();
    },

    milestonePayments(projectId: string) {
      return db("milestone_payments")
        .where({ project_id: projectId })
        .orderBy("sort_order", "asc")
        .select("id", "name", "phase", "status", "percent_complete", "amount", "proof_verified");
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
        );
    },

    keyDates(projectId: string) {
      return db("key_dates")
        .where({ project_id: projectId })
        .orderBy("target_date", "asc")
        .select("id", "label", "target_date", "actual_date", "status");
    },

    inspections(projectId: string) {
      return db("inspections")
        .where({ project_id: projectId })
        .orderBy("scheduled_at", "desc")
        .select("id", "title", "category", "status", "risk_level", "scheduled_at");
    },

    materials(projectId: string) {
      return db("material_orders")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc")
        .select(
          "id",
          "material_name",
          "quantity",
          "unit",
          "supplier",
          "status",
          "needed_by",
          "estimated_cost",
          "currency",
        );
    },

    materialStock(projectId: string) {
      return db("materials_stock as s")
        .join("materials_catalog as c", "c.id", "s.material_id")
        .where("s.project_id", projectId)
        .orderBy("c.name", "asc")
        .select(
          "c.name as material_name",
          "c.unit",
          "s.location_key",
          "s.on_hand_qty",
          "c.low_stock_threshold",
        );
    },

    documents(projectId: string) {
      return db("project_documents as d")
        .leftJoin("document_categories as c", "c.id", "d.category_id")
        .where("d.project_id", projectId)
        .orderBy("d.created_at", "desc")
        .select(
          "d.id",
          "d.file_name",
          "d.current_version_id",
          "c.name as categoryName",
          "c.group as categoryGroup",
        );
    },

    documentFile(projectId: string, documentId: string) {
      return db("project_documents as d")
        .leftJoin("document_categories as c", "c.id", "d.category_id")
        .leftJoin("document_versions as v", "v.id", "d.current_version_id")
        .leftJoin("uploaded_files as f", "f.id", "v.file_id")
        .where("d.project_id", projectId)
        .where("d.id", documentId)
        .first<{
          id: string;
          file_name: string;
          storage_path: string | null;
          mime_type: string | null;
          categoryName: string | null;
          categoryGroup: string | null;
        }>(
          "d.id",
          "d.file_name",
          "f.storage_path",
          "f.mime_type",
          "c.name as categoryName",
          "c.group as categoryGroup",
        );
    },

    tasks(projectId: string) {
      return db("tasks as t")
        .leftJoin("task_columns as col", "col.id", "t.column_id")
        .leftJoin("user as u", "u.id", "t.assignee_id")
        .leftJoin("team_members as tm", "tm.id", "t.assignee_team_member_id")
        .where("t.project_id", projectId)
        .orderBy("t.due_date", "asc")
        .limit(100)
        .select(
          "t.id",
          "t.title",
          "col.name as columnName",
          "t.due_date",
          "u.name as assigneeUserName",
          "tm.name as assigneeTeamName",
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
        .where("a.project_id", projectId)
        .whereIn("a.status", ["Pending", "Resubmit"])
        .orderBy("a.due_date", "asc")
        .limit(50)
        .select("a.id", "a.title", "a.category", "a.status", "a.due_date", "u.name as submittedBy");
    },

    actionItemsOpen(projectId: string) {
      return db("action_items as ai")
        .leftJoin("user as u", "u.id", "ai.assignee_id")
        .where("ai.project_id", projectId)
        .whereNot("ai.status", "Resolved")
        .orderBy("ai.due_date", "asc")
        .limit(50)
        .select("ai.id", "ai.title", "ai.status", "ai.priority", "ai.due_date", "u.name as assignee");
    },

    queriesOpen(projectId: string) {
      return db("queries as q")
        .leftJoin("user as u", "u.id", "q.assignee_id")
        .where("q.project_id", projectId)
        .whereNot("q.status", "Closed")
        .orderBy("q.due_date", "asc")
        .limit(50)
        .select("q.id", "q.subject as title", "q.status", "q.due_date", "u.name as assignee");
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
  };
}

export type AgentRepository = ReturnType<typeof agentRepository>;
