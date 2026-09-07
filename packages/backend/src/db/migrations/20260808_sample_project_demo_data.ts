import type { Knex } from "knex";

const PROJECT_ID = "sample-project";
const BUILDING_ID = "bld_sample_project_demo";
const SHARED_BUILDING_ID = `bld_shared_${PROJECT_ID}`;
const BOARD_ID = "tb_sample_project_demo";

function daysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function timestampDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

async function firstOrgId(knex: Knex): Promise<string | null> {
  const row = await knex("organization")
    .where("id", "not like", "demo_metrics_%")
    .orderBy("createdAt", "asc")
    .first<{ id: string }>("id");
  return row?.id ?? null;
}

async function ensureProject(knex: Knex): Promise<void> {
  const existing = await knex("projects")
    .where({ id: PROJECT_ID })
    .first<{ id: string; organization_id: string | null }>("id", "organization_id");
  const orgId = existing?.organization_id ?? await firstOrgId(knex);
  const project = {
    owner_id: null,
    organization_id: orgId,
    name: "Sample Project",
    address: "123 Example Street, Sample City",
    status: "On Track",
    health_score: 82,
    risk: "Low",
    progress_percent: 42,
    budget_total: "45000000.00",
    budget_used: "12850000.00",
    currency: "NGN",
    pending_approvals: 2,
    next_inspection_type: "Structural inspection",
    next_inspection_date: daysFromNow(7),
    folder_tone: "orange",
    budget_min: "40000000.00",
    budget_max: "50000000.00",
    setup: JSON.stringify({
      projectType: "residential",
      location: { state: "Lagos", city: "Lekki", ownsLand: true },
      buildingType: "Detached duplex",
      timeline: "6 months",
      fundingMethod: "Bank transfer",
      involvementLevel: "Managed by BuildPanda",
      riskOptions: ["Weather", "Material lead times"],
    }),
    ai_update_cadence: "weekly",
    updated_at: knex.fn.now(),
  };

  if (existing) {
    await knex("projects").where({ id: PROJECT_ID }).update(project);
    return;
  }
  await knex("projects").insert({ id: PROJECT_ID, ...project, created_at: knex.fn.now() });
}

async function ensureBuildingAndStages(knex: Knex): Promise<void> {
  await knex("buildings")
    .insert([
      { id: BUILDING_ID, project_id: PROJECT_ID, name: "Main House", kind: "real", status: "active", sort_order: 0, progress_percent: 42 },
      { id: SHARED_BUILDING_ID, project_id: PROJECT_ID, name: "Shared", kind: "shared", status: "active", sort_order: -1, progress_percent: 0 },
    ])
    .onConflict("id")
    .merge();

  await knex("project_phases")
    .insert([
      { id: "phase_sample_foundation", project_id: PROJECT_ID, building_id: BUILDING_ID, name: "Foundation", status: "Done", date_range: "Weeks 1-4", start_date: daysFromNow(-45), end_date: daysFromNow(-20), progress_percent: 100, value: "8000000.00", sort_order: 0 },
      { id: "phase_sample_shell", project_id: PROJECT_ID, building_id: BUILDING_ID, name: "Structural shell", status: "InProgress", date_range: "Weeks 5-10", start_date: daysFromNow(-19), end_date: daysFromNow(21), progress_percent: 55, value: "16500000.00", sort_order: 1 },
      { id: "phase_sample_finishes", project_id: PROJECT_ID, building_id: BUILDING_ID, name: "Finishes", status: "Pending", date_range: "Weeks 11-18", start_date: daysFromNow(22), end_date: daysFromNow(80), progress_percent: 0, value: "20500000.00", sort_order: 2 },
    ])
    .onConflict("id")
    .merge();
}

async function ensureFinances(knex: Knex): Promise<void> {
  await knex("project_finances")
    .insert({
      project_id: PROJECT_ID,
      currency: "NGN",
      total_budget: "45000000.00",
      amount_paid_to_date: "8500000.00",
      contract_sum: "45000000.00",
      variations_total: "750000.00",
      certified_gross_to_date: "12850000.00",
      retention_rate: "0.0500",
      retention_held: "642500.00",
      contract_type: "lump_sum",
      retention_release_mode: "staged_pc_dlp",
      payment_terms_days: 30,
      defects_liability_days: 365,
    })
    .onConflict("project_id")
    .merge();
}

async function ensureUpdates(knex: Knex): Promise<void> {
  await knex("project_updates")
    .insert([
      { id: "upd_sample_slab", project_id: PROJECT_ID, activity_id: null, author_id: "seed-pm", author_name: "Site Manager", author_role: "PM", author_initials_tone: "brand", category: "Progress", title: "First floor slab poured", description: "Concrete pour completed and cubes taken for strength testing.", description_html: "<p>Concrete pour completed and cubes taken for strength testing.</p>", cta_label: "View update", cta_tone: "primary", status: "Open", is_draft: false, generated_kind: null, created_at: timestampDaysFromNow(-3) },
      { id: "upd_sample_delivery", project_id: PROJECT_ID, activity_id: null, author_id: "seed-store", author_name: "Store Keeper", author_role: "Employee", author_initials_tone: "orange", category: "Material Delivery", title: "Cement delivery received", description: "400 bags received and stored in the ground-floor dry room.", description_html: "<p>400 bags received and stored in the ground-floor dry room.</p>", cta_label: "View delivery", cta_tone: "secondary", status: "Open", is_draft: false, generated_kind: null, created_at: timestampDaysFromNow(-1) },
    ])
    .onConflict("id")
    .merge();

  await knex("update_media")
    .insert([
      { id: "um_sample_slab_1", update_id: "upd_sample_slab", type: "photo", url: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=900&q=80", sort_order: 0 },
      { id: "um_sample_delivery_1", update_id: "upd_sample_delivery", type: "photo", url: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=80", sort_order: 0 },
    ])
    .onConflict("id")
    .merge();
}

async function ensureDailyLog(knex: Knex): Promise<void> {
  const logDate = daysFromNow(-1);
  await knex("daily_logs")
    .insert({ project_id: PROJECT_ID, building_id: BUILDING_ID, log_date: logDate, weather_condition: "Sunny", temperature_c: "29.00", precipitation_mm: "0.00", wind_kph: "8.00", workers_expected: 18, workers_present: 17, total_hours: "136.00", summary: "Cement delivery received, slab curing continued, and blockwork setting out checked.", summary_html: "<p>Cement delivery received, slab curing continued, and blockwork setting out checked.</p>", created_by_id: null })
    .onConflict(["project_id", "building_id", "log_date"])
    .merge();
  await knex("daily_log_entries")
    .insert({ id: "dle_sample_delivery", project_id: PROJECT_ID, building_id: BUILDING_ID, log_date: logDate, author_id: null, author_name: "Store Keeper", author_role: "Employee", body_html: "<p>Received 400 bags of cement and moved them into covered storage.</p>", body_text: "Received 400 bags of cement and moved them into covered storage." })
    .onConflict("id")
    .merge();
}

async function ensureApprovals(knex: Knex): Promise<void> {
  await knex("approvals")
    .insert([
      { id: "apr_sample_tile", project_id: PROJECT_ID, kind: "client", title: "Living room tile selection", category: "Finishes", description: "Matte porcelain tile sample submitted for homeowner sign-off.", description_html: "<p>Matte porcelain tile sample submitted for homeowner sign-off.</p>", status: "Pending", response: null, response_html: null, due_date: daysFromNow(5), submitted_by_id: null, requested_reviewer_id: null },
      { id: "apr_sample_cement", project_id: PROJECT_ID, kind: "material", title: "Approve 42.5N cement supplier", category: null, description: "Confirm cement grade and supplier before the next concrete pour.", description_html: "<p>Confirm cement grade and supplier before the next concrete pour.</p>", status: "Pending", response: null, response_html: null, due_date: daysFromNow(2), submitted_by_id: null, requested_reviewer_id: null },
    ])
    .onConflict("id")
    .merge();
  await knex("material_approval_details")
    .insert({ approval_id: "apr_sample_cement", material_name: "Portland cement 42.5N", specification: "BS EN 197-1 CEM II/B-L 42.5N", quantity: "400.00", unit: "bag", supplier: "Dangote Cement", needed_by: daysFromNow(7), phase_id: "phase_sample_shell", activity_id: null })
    .onConflict("approval_id")
    .merge();
}

async function ensureMaterials(knex: Knex): Promise<void> {
  await knex("material_orders")
    .insert({ id: "mo_sample_cement", project_id: PROJECT_ID, title: "Cement for second pour", material_name: "Portland cement", quantity: "400.00", unit: "bag", supplier: "Dangote Cement", status: "Approved", priority: "High", phase_id: "phase_sample_shell", needed_by: daysFromNow(7), estimated_cost: "4200000.00", actual_cost: "0.00", currency: "NGN", delivery_location: "Main House dry room", notes: "Supplier confirmed stock for next pour." })
    .onConflict("id")
    .merge();
  await knex("materials_catalog")
    .insert({ id: "mcat_sample_cement", project_id: PROJECT_ID, name: "Portland cement", normalized_name: "portland cement", unit: "bag", low_stock_threshold: "100.00", active: true, reorder_quantity: "200.00", lead_time_days: 3, auto_reorder_enabled: false })
    .onConflict("id")
    .merge();
  await knex("materials_stock")
    .insert({ project_id: PROJECT_ID, material_id: "mcat_sample_cement", location_key: "default", on_hand_qty: "280.00", last_ledger_entry_id: null })
    .onConflict(["project_id", "material_id", "location_key"])
    .merge();
  await knex("material_ledger_entries")
    .insert({ id: "mle_sample_cement_in", project_id: PROJECT_ID, idempotency_key: "sample-cement-in", entry_type: "IN", status: "Posted", material_id: "mcat_sample_cement", material_name_snapshot: "Portland cement", unit_snapshot: "bag", location_key: "default", quantity: "400.00", stock_delta: "400.00", occurred_at: timestampDaysFromNow(-1), timestamp_suspect: false, negative_stock: false, reason: "Initial sample-project delivery", notes_html: "<p>Received against approved supplier quote.</p>", stage_id: "phase_sample_shell", approval_status: "Approved" })
    .onConflict("id")
    .merge();
}

async function ensureTasksAndDates(knex: Knex): Promise<void> {
  await knex("task_boards").insert({ id: BOARD_ID, project_id: PROJECT_ID, building_id: BUILDING_ID, name: "Site tasks", is_default: true }).onConflict("id").merge();
  await knex("task_columns")
    .insert([
      { id: "tc_sample_todo", board_id: BOARD_ID, name: "To do", status: "Todo", position: 0 },
      { id: "tc_sample_doing", board_id: BOARD_ID, name: "Doing", status: "Doing", position: 1 },
      { id: "tc_sample_done", board_id: BOARD_ID, name: "Done", status: "Done", position: 2 },
    ])
    .onConflict("id")
    .merge();
  await knex("tasks")
    .insert([
      { id: "tsk_sample_rebar", project_id: PROJECT_ID, building_id: BUILDING_ID, board_id: BOARD_ID, column_id: "tc_sample_doing", title: "Check rebar before next pour", description: "Confirm lap lengths and cover blocks before concrete truck arrives.", description_html: "<p>Confirm lap lengths and cover blocks before concrete truck arrives.</p>", due_date: daysFromNow(2), priority: "High", labels: JSON.stringify(["structure"]), position: 0, created_by_id: null },
      { id: "tsk_sample_tiles", project_id: PROJECT_ID, building_id: BUILDING_ID, board_id: BOARD_ID, column_id: "tc_sample_todo", title: "Send tile samples to homeowner", description: "Prepare two finish options for approval.", description_html: "<p>Prepare two finish options for approval.</p>", due_date: daysFromNow(5), priority: "Medium", labels: JSON.stringify(["approval"]), position: 1, created_by_id: null },
    ])
    .onConflict("id")
    .merge();
  await knex("key_dates")
    .insert([
      { id: "kd_sample_roof", project_id: PROJECT_ID, building_id: BUILDING_ID, label: "Roof on", target_date: daysFromNow(35), actual_date: null, status: "Upcoming", notes: "Target before rainy-season peak.", sort_order: 0 },
      { id: "kd_sample_slab", project_id: PROJECT_ID, building_id: BUILDING_ID, label: "First floor slab", target_date: daysFromNow(-3), actual_date: daysFromNow(-2), status: "Met", notes: "Completed one day late after delivery delay.", sort_order: 1 },
    ])
    .onConflict("id")
    .merge();
}

async function ensureDocuments(knex: Knex): Promise<void> {
  await knex("document_categories")
    .insert([
      { id: "cat_sample_docs", name: "Sample Documents", tone: "brand", group: "document" },
      { id: "cat_sample_plans", name: "Sample Plans", tone: "orange", group: "plan" },
    ])
    .onConflict("id")
    .merge();
  await knex("project_documents")
    .insert([
      { id: "doc_sample_method", project_id: PROJECT_ID, category_id: "cat_sample_docs", file_id: null, file_name: "Concrete pour method statement.pdf", size: "248 KB", status: "Verified", uploaded_at: daysFromNow(-12), current_version_id: null },
      { id: "doc_sample_plan", project_id: PROJECT_ID, category_id: "cat_sample_plans", file_id: null, file_name: "GA floor plan Rev C.pdf", size: "1.4 MB", status: "Pending", uploaded_at: daysFromNow(-6), current_version_id: null },
    ])
    .onConflict("id")
    .merge();
}

export async function up(knex: Knex): Promise<void> {
  await ensureProject(knex);
  await ensureBuildingAndStages(knex);
  await ensureFinances(knex);
  await ensureUpdates(knex);
  await ensureDailyLog(knex);
  await ensureApprovals(knex);
  await ensureMaterials(knex);
  await ensureTasksAndDates(knex);
  await ensureDocuments(knex);
}

export async function down(knex: Knex): Promise<void> {
  await knex("project_documents").whereIn("id", ["doc_sample_method", "doc_sample_plan"]).del();
  await knex("document_categories").whereIn("id", ["cat_sample_docs", "cat_sample_plans"]).del();
  await knex("key_dates").whereIn("id", ["kd_sample_roof", "kd_sample_slab"]).del();
  await knex("tasks").whereIn("id", ["tsk_sample_rebar", "tsk_sample_tiles"]).del();
  await knex("task_columns").whereIn("id", ["tc_sample_todo", "tc_sample_doing", "tc_sample_done"]).del();
  await knex("task_boards").where({ id: BOARD_ID }).del();
  await knex("material_ledger_entries").where({ id: "mle_sample_cement_in" }).del();
  await knex("materials_stock").where({ project_id: PROJECT_ID, material_id: "mcat_sample_cement" }).del();
  await knex("materials_catalog").where({ id: "mcat_sample_cement" }).del();
  await knex("material_orders").where({ id: "mo_sample_cement" }).del();
  await knex("material_approval_details").where({ approval_id: "apr_sample_cement" }).del();
  await knex("approvals").whereIn("id", ["apr_sample_tile", "apr_sample_cement"]).del();
  await knex("daily_log_entries").where({ id: "dle_sample_delivery" }).del();
  await knex("daily_logs").where({ project_id: PROJECT_ID, building_id: BUILDING_ID }).del();
  await knex("update_media").whereIn("id", ["um_sample_slab_1", "um_sample_delivery_1"]).del();
  await knex("project_updates").whereIn("id", ["upd_sample_slab", "upd_sample_delivery"]).del();
}
