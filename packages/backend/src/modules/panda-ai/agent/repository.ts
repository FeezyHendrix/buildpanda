import type { Knex } from "knex";

interface DeliveryRow {
  order_id: string;
  delivered_qty: string;
  delivered_at: string;
  delivery_note: string | null;
  rejected: boolean;
  rejected_reason: string | null;
}

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

    /** The contract dates and where completion stands after awarded EOTs. */
    scheduleDates(projectId: string) {
      return db("projects")
        .where({ id: projectId })
        .first<{
          start_date: string | null;
          completion_date: string | null;
          revised_completion_date: string | null;
        }>("start_date", "completion_date", "revised_completion_date");
    },

    /** Delays with the attribution that decides whether the time is claimable. */
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

    /** Time claims — change requests of type eot_only, days claimed vs awarded. */
    eotClaims(projectId: string) {
      return db("change_requests")
        .where({ project_id: projectId, type: "eot_only" })
        .orderBy("created_at", "asc")
        .select("id", "title", "status", "time_impact_days", "days_awarded", "decided_at");
    },

    /** How far the projected finish has moved from the baseline programme. */
    timelineShift(projectId: string) {
      return db("activities")
        .where({ project_id: projectId })
        .whereNotNull("baseline_end_at")
        .first<{ shift: string | null } | undefined>(
          db.raw("MAX(EXTRACT(EPOCH FROM (planned_end_at - baseline_end_at)) / 86400) as shift"),
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

    stageNames(projectId: string): Promise<Array<{ id: string; name: string }>> {
      return db("project_phases")
        .where({ project_id: projectId })
        .orderBy("sort_order", "asc")
        .select("id", "name");
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
          "voided_at",
        );
    },

    /**
     * The work behind the headcount: which activity each day's hours went on.
     * A diary that reports only weather and crew size never says what was built.
     */
    dailyLogActivityHours(projectId: string, logDates: string[]) {
      return db("daily_log_activities as dla")
        .join("activities as a", "a.id", "dla.activity_id")
        .where("dla.project_id", projectId)
        .whereIn("dla.log_date", logDates)
        .orderBy("dla.log_date", "desc")
        .select("dla.log_date", "a.name as activity_name", "dla.hours_logged");
    },

    /** The written diary for each day, voided entries left out. */
    dailyLogEntries(projectId: string, logDates: string[]) {
      return db("daily_log_entries as e")
        .leftJoin("daily_log_entry_voids as v", "v.entry_id", "e.id")
        .where("e.project_id", projectId)
        .whereIn("e.log_date", logDates)
        .whereNull("v.id")
        .orderBy("e.created_at", "asc")
        .select("e.log_date", "e.author_name", "e.author_role", "e.body_text");
    },

    keyDates(projectId: string) {
      return db("key_dates")
        .where({ project_id: projectId })
        .orderBy("target_date", "asc")
        .select("id", "label", "target_date", "actual_date", "status");
    },

    /**
     * An inspection is an independent service order, so the service status, the
     * assigned BuildPanda inspector and the outcome all matter to a PM asking
     * "has anyone been out yet?".
     */
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

    deliveriesForOrders(orderIds: string[]) {
      // knex renders an empty whereIn as a false predicate, so no early return.
      return db<DeliveryRow>("material_deliveries")
        .whereIn("order_id", orderIds)
        .orderBy("delivered_at", "asc")
        .select(
          "order_id",
          "delivered_qty",
          "delivered_at",
          "delivery_note",
          "rejected",
          "rejected_reason",
        );
    },

    /**
     * Late is a fact about dates, not a status: wanted before today and still
     * not delivered, or promised by the supplier after the date it was wanted.
     * Cancelled and rejected orders are closed and cannot be late.
     */
    lateMaterials(projectId: string, today: string) {
      return db("material_orders")
        .where({ project_id: projectId })
        .whereNotIn("status", ["Delivered", "Cancelled", "Rejected"])
        .where((q) =>
          q
            .where("needed_by", "<", today)
            .orWhereRaw("expected_delivery_at IS NOT NULL AND expected_delivery_at > needed_by"),
        )
        .orderBy("needed_by", "asc")
        .select(
          "id",
          "material_name",
          "quantity",
          "unit",
          "supplier",
          "status",
          "needed_by",
          "expected_delivery_at",
          "estimated_cost",
          "currency",
        );
    },

    preconBoqRows(projectId: string) {
      return db("precon_boq_rows as row")
        .join("precon_bills as bill", "bill.id", "row.bill_id")
        .join("precon_sessions as session", "session.id", "bill.session_id")
        .where("session.project_id", projectId)
        .whereIn("row.row_type", ["item", "provisional_sum"])
        .where((q) => q.whereNot("row.status", "rejected").orWhereNull("row.status"))
        .orderBy([
          { column: "session.created_at", order: "asc" },
          { column: "row.sort", order: "asc" },
        ])
        .select(
          "session.id as session_id",
          "session.title as session_title",
          "session.status as session_status",
          "row.element_group",
          "row.code",
          "row.description",
          "row.qty",
          "row.unit",
          "row.rate",
          "row.amount",
          "row.status",
          "row.confidence",
        );
    },

    boqItems(projectId: string) {
      return db("proposal_boq_items as item")
        .join("proposals as proposal", "proposal.id", "item.proposal_id")
        .where("proposal.project_id", projectId)
        .whereIn("proposal.status", ["Accepted", "Converted"])
        .orderBy("item.sort", "asc")
        .select(
          "proposal.id as proposal_id",
          "proposal.title as proposal_title",
          "proposal.status as proposal_status",
          "item.id",
          "item.group_label",
          "item.description",
          "item.qty",
          "item.unit",
        );
    },

    // The accepted offer this project was converted from: the estimate the
    // project row points at, else the accepted estimate of the linked proposal.
    async acceptedEstimate(projectId: string) {
      const project = await db("projects")
        .where({ id: projectId })
        .select<{ estimate_id: string | null }>("estimate_id")
        .first();
      const estimate = await db("estimates as e")
        .join("proposals as p", "p.id", "e.proposal_id")
        .where("p.project_id", projectId)
        .modify((q) => {
          if (project?.estimate_id) q.where("e.id", project.estimate_id);
          else q.whereIn("e.status", ["Accepted", "Superseded", "Sent"]).orderBy("e.revision_no", "desc");
        })
        .select(
          "e.id",
          "e.revision_no",
          "e.status",
          "e.contingency_pct",
          "e.tax_label",
          "e.tax_pct",
          "e.subtotal",
          "e.tax_amount",
          "e.total",
          "e.accepted_at",
          "e.accepted_by_name",
          "p.id as proposal_id",
          "p.title as proposal_title",
          "p.currency",
        )
        .first();
      if (!estimate) return null;
      const [items, schedule] = await Promise.all([
        db("estimate_items").where({ estimate_id: estimate.id }).orderBy("sort", "asc").select("group_label", "description", "qty", "unit", "unit_rate", "total"),
        db("estimate_payment_schedule").where({ estimate_id: estimate.id }).orderBy("sort", "asc").select("label", "percent", "description"),
      ]);
      return { estimate, items, schedule };
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

    /**
     * On-hand stock with the received/used totals behind it, mirroring the
     * Material log page's stock cards (materialsLedgerRepository.listStock).
     *
     * Only accepted, un-voided movements count: a pending entry is a claim that
     * never moved stock, and a voided one was undone by its reversal — counting
     * either would make received minus used disagree with on_hand_qty.
     */
    materialStock(projectId: string) {
      const movements = db("material_ledger_entries")
        .select("material_id")
        .select(
          db.raw("COALESCE(SUM(CASE WHEN entry_type = 'IN' THEN quantity ELSE 0 END), 0) as total_received"),
        )
        .select(
          db.raw("COALESCE(SUM(CASE WHEN entry_type = 'USED' THEN quantity ELSE 0 END), 0) as total_used"),
        )
        .select(
          db.raw("COUNT(*) FILTER (WHERE status = 'Voided') as voided_count"),
        )
        .select(
          db.raw("COALESCE(SUM(CASE WHEN status = 'Voided' AND entry_type = 'IN' THEN quantity ELSE 0 END), 0) as voided_received"),
        )
        .select(
          db.raw("COALESCE(SUM(CASE WHEN status = 'Voided' AND entry_type = 'USED' THEN quantity ELSE 0 END), 0) as voided_used"),
        )
        .where({ project_id: projectId, approval_status: "Approved" })
        .groupBy("material_id");

      return db("materials_stock as s")
        .join("materials_catalog as c", "c.id", "s.material_id")
        .leftJoin(movements.as("m"), "m.material_id", "s.material_id")
        .where("s.project_id", projectId)
        .orderBy("c.name", "asc")
        .select(
          "c.name as material_name",
          "c.unit",
          "s.location_key",
          "s.on_hand_qty",
          "c.low_stock_threshold",
          db.raw("COALESCE(m.total_received, 0) - COALESCE(m.voided_received, 0) as total_received"),
          db.raw("COALESCE(m.total_used, 0) - COALESCE(m.voided_used, 0) as total_used"),
          db.raw("COALESCE(m.voided_count, 0) as voided_entry_count"),
          db.raw("COALESCE(m.voided_received, 0) as voided_received"),
          db.raw("COALESCE(m.voided_used, 0) as voided_used"),
        );
    },

    /**
     * The material ledger itself — every receipt, issue and void, newest first.
     *
     * A void is a record, not a deletion: the original entry stays with
     * status 'Voided' and a VOID entry is posted against it carrying the reason
     * and the person who voided it. Both rows come back so the assistant can
     * report the void as a void instead of losing the movement entirely.
     */
    materialLedgerEntries(projectId: string, limit: number) {
      return db("material_ledger_entries as e")
        .leftJoin("user as u", "u.id", "e.logged_by_id")
        .leftJoin("user as au", "au.id", "e.approved_by_id")
        .where("e.project_id", projectId)
        .orderBy("e.occurred_at", "desc")
        .limit(limit)
        .select(
          "e.id",
          "e.entry_type",
          "e.status",
          "e.material_name_snapshot as material_name",
          "e.unit_snapshot as unit",
          "e.location_key",
          "e.quantity",
          "e.stock_delta",
          "e.occurred_at",
          "e.approval_status",
          "e.reversal_for_entry_id",
          "e.reason",
          "e.supplier",
          "e.delivery_note",
          "e.negative_stock",
          "e.timestamp_suspect",
          "e.self_approved",
          "u.name as logged_by_name",
          "au.name as approved_by_name",
        );
    },

    /**
     * The VOID entries that reverse the given entries. A void is posted after
     * the movement it undoes, so the reversal can sit outside a page of the
     * ledger while the entry it voided is inside it; one batched read stitches
     * the reason and the actor back on rather than a query per row.
     */
    materialLedgerReversalsFor(entryIds: string[]) {
      if (entryIds.length === 0) {
        return Promise.resolve([] as Array<{
          reversal_for_entry_id: string;
          reason: string | null;
          occurred_at: string;
          logged_by_name: string | null;
        }>);
      }
      return db("material_ledger_entries as e")
        .leftJoin("user as u", "u.id", "e.logged_by_id")
        .where("e.entry_type", "VOID")
        .whereIn("e.reversal_for_entry_id", entryIds)
        .select<Array<{
          reversal_for_entry_id: string;
          reason: string | null;
          occurred_at: string;
          logged_by_name: string | null;
        }>>(
          "e.reversal_for_entry_id",
          "e.reason",
          "e.occurred_at",
          "u.name as logged_by_name",
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

    drawingMarkupsOpen(projectId: string) {
      return db("drawing_markups as m")
        .join("project_documents as d", "d.id", "m.document_id")
        .leftJoin("document_versions as v", "v.id", "m.document_version_id")
        .leftJoin("drawing_markup_comments as c", "c.markup_id", "m.id")
        .leftJoin("user as u", "u.id", "c.created_by_id")
        .leftJoin("rfis as r", "r.source_markup_id", "m.id")
        .where("m.project_id", projectId)
        .whereNull("m.resolved_at")
        .orderBy("m.created_at", "desc")
        .limit(50)
        .select(
          "m.id",
          "d.file_name as sheet",
          "v.revision_label as revision",
          db.raw("(d.current_version_id = m.document_version_id) as on_current_revision"),
          "m.kind",
          "c.body as comment",
          "u.name as raisedBy",
          "m.created_at",
          "r.id as rfiId",
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
            "COALESCE(r.subject, cr.title, mo.material_name, inv.vendor_name, mp.name) as label",
          ),
        );
    },

    /**
     * Everything on the project whose text names a piece of work — "culvert 1",
     * "ch 0+420", "the box culvert". A PM asking "what changed on X" means the
     * records that describe work, so one query sweeps activities and their
     * delays, RFIs, change requests, risks, inspections and material orders
     * rather than leaving the model to guess a single domain tool.
     */
  };
}

export type AgentRepository = ReturnType<typeof agentRepository>;
