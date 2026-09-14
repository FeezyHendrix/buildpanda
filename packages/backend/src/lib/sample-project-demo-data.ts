import type { Knex } from "knex";
import { generateId } from "./ids.ts";

interface DemoContext {
  projectId: string; buildingId: string; phaseIds: string[];
  weeksFromNow: (weeks: number) => Date; isoDate: (date: Date) => string;
}

export async function addSampleProjectDemoData(trx: Knex.Transaction, ctx: DemoContext): Promise<void> {
  const materialApprovalId = generateId("apr");
  const updateId = generateId("upd");
  const boardId = generateId("tb");
  const todoColumnId = generateId("tc");
  const doingColumnId = generateId("tc");
  const materialId = generateId("mcat");

  await trx("daily_log_entries").insert({
    id: generateId("dle"),
    project_id: ctx.projectId,
    building_id: ctx.buildingId,
    log_date: ctx.isoDate(ctx.weeksFromNow(-1)),
    author_id: null,
    author_name: "Site Manager",
    author_role: "PM",
    body_html: "<p>Formwork completed and rebar laid for the next pour.</p>",
    body_text: "Formwork completed and rebar laid for the next pour.",
  });

  await trx("project_finances").insert({
    project_id: ctx.projectId,
    currency: "NGN",
    total_budget: 85_000_000,
    amount_paid_to_date: 12_500_000,
    contract_sum: 85_000_000,
    variations_total: 1_250_000,
    certified_gross_to_date: 28_900_000,
    retention_rate: "0.0500",
    retention_held: 1_445_000,
    contract_type: "lump_sum",
    retention_release_mode: "staged_pc_dlp",
    payment_terms_days: 30,
    defects_liability_days: 365,
  });

  await addSampleUpdateAndDocuments(trx, ctx, updateId);
  await addSampleApprovals(trx, ctx, materialApprovalId);
  await addSampleMaterials(trx, ctx, materialId);
  await addSampleTasks(trx, ctx, boardId, todoColumnId, doingColumnId);
}

async function addSampleUpdateAndDocuments(trx: Knex.Transaction, ctx: DemoContext, updateId: string): Promise<void> {
  await trx("project_updates").insert({
    id: updateId,
    project_id: ctx.projectId,
    author_id: "sample-pm",
    author_name: "Site Manager",
    author_role: "PM",
    author_initials_tone: "brand",
    category: "Progress",
    title: "First floor slab nearly ready",
    description: "Formwork and rebar are complete; final inspection is booked before the concrete pour.",
    description_html: "<p>Formwork and rebar are complete; final inspection is booked before the concrete pour.</p>",
    cta_label: "View update",
    cta_tone: "primary",
    status: "Open",
    is_draft: false,
    generated_kind: null,
    created_at: ctx.weeksFromNow(-1).toISOString(),
  });
  await trx("update_media").insert({
    id: generateId("um"),
    update_id: updateId,
    type: "photo",
    url: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=900&q=80",
    sort_order: 0,
  });
  await trx("project_documents").insert([
    sampleDocument(ctx, "Concrete pour method statement.pdf", "248 KB", "Verified", -2),
    sampleDocument(ctx, "GA floor plan Rev C.pdf", "1.4 MB", "Pending", -1),
  ]);
}

function sampleDocument(ctx: DemoContext, fileName: string, size: string, status: string, weeks: number) {
  return {
    id: generateId("doc"),
    project_id: ctx.projectId,
    category_id: null,
    file_id: null,
    file_name: fileName,
    size,
    status,
    uploaded_at: ctx.isoDate(ctx.weeksFromNow(weeks)),
    current_version_id: null,
  };
}

async function addSampleApprovals(trx: Knex.Transaction, ctx: DemoContext, materialApprovalId: string): Promise<void> {
  await trx("approvals").insert([
    {
      id: generateId("apr"),
      project_id: ctx.projectId,
      kind: "client",
      title: "Living room tile selection",
      category: "Finishes",
      description: "Matte porcelain tile sample submitted for homeowner sign-off.",
      description_html: "<p>Matte porcelain tile sample submitted for homeowner sign-off.</p>",
      status: "Pending",
      due_date: ctx.isoDate(ctx.weeksFromNow(1)),
      submitted_by_id: null,
      requested_reviewer_id: null,
    },
    {
      id: materialApprovalId,
      project_id: ctx.projectId,
      kind: "material",
      title: "Approve 42.5N cement supplier",
      category: null,
      description: "Confirm cement grade and supplier before the next concrete pour.",
      description_html: "<p>Confirm cement grade and supplier before the next concrete pour.</p>",
      status: "Pending",
      due_date: ctx.isoDate(ctx.weeksFromNow(1)),
      submitted_by_id: null,
      requested_reviewer_id: null,
    },
  ]);
  await trx("material_approval_details").insert({
    approval_id: materialApprovalId,
    material_name: "Portland cement 42.5N",
    specification: "BS EN 197-1 CEM II/B-L 42.5N",
    quantity: 400,
    unit: "bag",
    supplier: "Dangote Cement",
    needed_by: ctx.isoDate(ctx.weeksFromNow(2)),
    phase_id: ctx.phaseIds[1],
    activity_id: null,
  });
}

async function addSampleMaterials(trx: Knex.Transaction, ctx: DemoContext, materialId: string): Promise<void> {
  await trx("materials_catalog").insert({
    id: materialId,
    project_id: ctx.projectId,
    name: "Portland cement",
    normalized_name: "portland cement",
    unit: "bag",
    low_stock_threshold: 100,
    active: true,
    reorder_quantity: 200,
    lead_time_days: 3,
    auto_reorder_enabled: false,
  });
  await trx("materials_stock").insert({
    project_id: ctx.projectId,
    material_id: materialId,
    location_key: "default",
    on_hand_qty: 280,
    last_ledger_entry_id: null,
  });
  await trx("material_orders").insert({
    id: generateId("mo"),
    project_id: ctx.projectId,
    title: "Cement for second pour",
    material_name: "Portland cement",
    quantity: 400,
    unit: "bag",
    supplier: "Dangote Cement",
    status: "Approved",
    priority: "High",
    phase_id: ctx.phaseIds[1],
    needed_by: ctx.isoDate(ctx.weeksFromNow(2)),
    estimated_cost: 4_200_000,
    actual_cost: 0,
    currency: "NGN",
    delivery_location: "Main Duplex dry room",
    notes: "Supplier confirmed stock for next pour.",
  });
  await trx("material_ledger_entries").insert({
    id: generateId("mle"),
    project_id: ctx.projectId,
    idempotency_key: `${ctx.projectId}:sample-cement-in`,
    entry_type: "IN",
    status: "Posted",
    material_id: materialId,
    material_name_snapshot: "Portland cement",
    unit_snapshot: "bag",
    location_key: "default",
    quantity: 400,
    stock_delta: 400,
    occurred_at: ctx.weeksFromNow(-1).toISOString(),
    timestamp_suspect: false,
    negative_stock: false,
    reason: "Initial sample-project delivery",
    notes_html: "<p>Received against approved supplier quote.</p>",
    stage_id: ctx.phaseIds[1],
    approval_status: "Approved",
  });
}

async function addSampleTasks(trx: Knex.Transaction, ctx: DemoContext, boardId: string, todoColumnId: string, doingColumnId: string): Promise<void> {
  await trx("task_boards").insert({
    id: boardId,
    project_id: ctx.projectId,
    building_id: ctx.buildingId,
    name: "Site tasks",
    is_default: true,
    created_by_id: null,
  });
  await trx("task_columns").insert([
    { id: todoColumnId, board_id: boardId, name: "To do", status: "Todo", position: 0 },
    { id: doingColumnId, board_id: boardId, name: "Doing", status: "Doing", position: 1 },
    { id: generateId("tc"), board_id: boardId, name: "Done", status: "Done", position: 2 },
  ]);
  await trx("tasks").insert([
    sampleTask(ctx, boardId, doingColumnId, "Check rebar before next pour", "structure", "High", 0),
    sampleTask(ctx, boardId, todoColumnId, "Send tile samples to homeowner", "approval", "Medium", 1),
  ]);
}

function sampleTask(ctx: DemoContext, boardId: string, columnId: string, title: string, label: string, priority: "High" | "Medium", position: number) {
  return {
    id: generateId("tsk"),
    project_id: ctx.projectId,
    building_id: ctx.buildingId,
    board_id: boardId,
    column_id: columnId,
    title,
    description: position === 0 ? "Confirm lap lengths and cover blocks before concrete truck arrives." : "Prepare two finish options for approval.",
    description_html: position === 0 ? "<p>Confirm lap lengths and cover blocks before concrete truck arrives.</p>" : "<p>Prepare two finish options for approval.</p>",
    due_date: ctx.isoDate(ctx.weeksFromNow(1)),
    priority,
    labels: JSON.stringify([label]),
    position,
    created_by_id: null,
  };
}
