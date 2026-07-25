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

    financeEvents(projectId: string) {
      return db("finance_events")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc")
        .limit(100)
        .select("type", "actor_name", "summary", "amount", "created_at");
    },

    transactions(projectId: string, filters: { category?: string; from?: string; to?: string; limit?: number }) {
      const query = db("project_transactions")
        .where({ project_id: projectId })
        .orderBy("transacted_at", "desc")
        .limit(filters.limit ?? 200)
        .select(
          "id",
          "title",
          "description",
          "category",
          "category_type",
          "amount",
          "transacted_at",
          "vendor",
          "reference",
          "created_at",
        );
      if (filters.category) query.where("category", filters.category);
      if (filters.from) query.where("transacted_at", ">=", filters.from);
      if (filters.to) query.where("transacted_at", "<=", filters.to);
      return query;
    },

    transactionTotalsByCategory(projectId: string, filters: { from?: string; to?: string }) {
      const query = db("project_transactions")
        .where({ project_id: projectId })
        .groupBy("category")
        .orderBy(db.raw("SUM(amount)"), "desc")
        .select("category")
        .sum({ total: "amount" })
        .count({ count: "id" });
      if (filters.from) query.where("transacted_at", ">=", filters.from);
      if (filters.to) query.where("transacted_at", "<=", filters.to);
      return query;
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

    suppliers(projectId: string) {
      return db("suppliers")
        .where({ project_id: projectId, active: true })
        .orderBy("name", "asc")
        .select("name", "contact_name", "email", "phone", "address");
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

    taskComments(projectId: string) {
      return db("task_comments as c")
        .join("tasks as t", "t.id", "c.task_id")
        .where("t.project_id", projectId)
        .orderBy("c.created_at", "asc")
        .limit(200)
        .select("t.title as taskTitle", "c.author_name as authorName", "c.body", "c.created_at");
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

    invoices(projectId: string, status?: string) {
      // One query: invoices with their paid total aggregated via the payments join.
      return db("project_invoices as i")
        .leftJoin("invoice_payments as p", "p.invoice_id", "i.id")
        .where("i.project_id", projectId)
        .modify((q) => {
          if (status) q.where("i.status", status);
        })
        .groupBy("i.id")
        .orderBy("i.created_at", "desc")
        .limit(100)
        .select(
          "i.id",
          "i.number",
          "i.vendor_name",
          "i.invoice_type",
          "i.status",
          "i.currency",
          "i.issue_date",
          "i.due_date",
          "i.total_invoiced",
          "i.net_payable",
          "i.to_party",
        )
        .sum({ amount_paid: "p.amount" });
    },

    budgetCategories(projectId: string) {
      return db("project_budget_categories")
        .where({ project_id: projectId })
        .orderBy("sort_order", "asc")
        .select("id", "name", "cost_code", "planned", "committed", "actual");
    },

    purchaseOrders(projectId: string) {
      // One query: POs with their total aggregated from line items.
      return db("purchase_orders as po")
        .leftJoin("purchase_order_items as it", "it.purchase_order_id", "po.id")
        .where("po.project_id", projectId)
        .groupBy("po.id")
        .orderBy("po.created_at", "desc")
        .limit(100)
        .select(
          "po.id",
          "po.po_number",
          "po.vendor_name",
          "po.status",
          "po.order_date",
          "po.expected_date",
          db.raw("coalesce(sum(it.quantity * it.unit_price), 0) as total"),
        );
    },

    transactionCategoryAnalytics(projectId: string) {
      return db("project_transactions as t")
        .join("project_transaction_categories as c", "c.id", "t.category_id")
        .where("t.project_id", projectId)
        .groupBy("c.id", "c.name")
        .orderByRaw("SUM(t.amount) DESC")
        .select("c.name as category_name", db.raw("COALESCE(SUM(t.amount), 0) as total"), db.raw("COUNT(t.id) as count"));
    },

    transactionRecent(projectId: string, limit: number) {
      return db("project_transactions as t")
        .join("project_transaction_categories as c", "c.id", "t.category_id")
        .where("t.project_id", projectId)
        .orderBy("t.created_at", "desc")
        .limit(limit)
        .select("t.id", "t.title", "t.amount", "c.name as category_name", "t.transaction_date");
    },

    transactionTotal(projectId: string): Promise<number> {
      return db("project_transactions")
        .where({ project_id: projectId })
        .sum<{ total: string | null }[]>("amount as total")
        .first()
        .then((r) => Number(r?.total ?? 0));
    },

    paymentSettings(projectId: string) {
      return db("project_finances")
        .where({ project_id: projectId })
        .first(
          "currency",
          "payment_models",
          "mobilization_advance",
          "mobilization_outstanding",
          "mobilization_amort_type",
          "mobilization_amort_value",
          "retention_held",
          "retention_rate",
          "retention_released_pc",
          "retention_released_dl",
        );
    },

    retentionReleases(projectId: string) {
      return db("retention_releases")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc")
        .limit(50)
        .select("stage", "amount", "status", "released_at", "released_by", "notes");
    },

    advanceAmortizations(projectId: string) {
      return db("advance_amortizations as aa")
        .leftJoin("milestone_payments as mp", "mp.id", "aa.milestone_id")
        .where("aa.project_id", projectId)
        .orderBy("aa.recovered_at", "desc")
        .limit(100)
        .select("aa.amount", "aa.recovered_at", "mp.name as milestone_name");
    },

    measuredWork(projectId: string) {
      return db("measured_work_records")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc")
        .limit(200)
        .select(
          "description",
          "unit",
          "quantity",
          "unit_rate",
          "amount",
          "period_start",
          "period_end",
          "status",
          "certified_at",
        );
    },

    paymentClaims(projectId: string) {
      return db("payment_claims as pc")
        .leftJoin("milestone_payments as mp", "mp.id", "pc.milestone_payment_id")
        .where("pc.project_id", projectId)
        .orderBy("pc.created_at", "desc")
        .limit(100)
        .select(
          "pc.id",
          "pc.claim_number",
          "pc.status",
          "pc.amount",
          "pc.period_start",
          "pc.period_end",
          "pc.submitted_at",
          "pc.approved_at",
          "mp.name as milestone_name",
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

    taskEntityLinks(projectId: string) {
      return db("task_entity_links as el")
        .join("tasks as t", "t.id", "el.task_id")
        .leftJoin("action_items as ai", function () {
          this.on("el.entity_type", db.raw("?", ["action_item"])).andOn("ai.id", "el.entity_id");
        })
        .leftJoin("rfis as r", function () {
          this.on("el.entity_type", db.raw("?", ["rfi"])).andOn("r.id", "el.entity_id");
        })
        .leftJoin("change_requests as cr", function () {
          this.on("el.entity_type", db.raw("?", ["change_request"])).andOn("cr.id", "el.entity_id");
        })
        .leftJoin("material_orders as mo", function () {
          this.on("el.entity_type", db.raw("?", ["material"])).andOn("mo.id", "el.entity_id");
        })
        .leftJoin("project_invoices as inv", function () {
          this.on("el.entity_type", db.raw("?", ["invoice"])).andOn("inv.id", "el.entity_id");
        })
        .leftJoin("milestone_payments as mp", function () {
          this.on("el.entity_type", db.raw("?", ["milestone_payment"])).andOn("mp.id", "el.entity_id");
        })
        .where("el.project_id", projectId)
        .orderBy("t.title", "asc")
        .limit(200)
        .select(
          "t.title as taskTitle",
          "el.entity_type as entityType",
          db.raw(
            "COALESCE(ai.title, r.subject, cr.title, mo.material_name, inv.vendor_name, mp.name) as label",
          ),
        );
    },
  };
}

export type AgentRepository = ReturnType<typeof agentRepository>;
