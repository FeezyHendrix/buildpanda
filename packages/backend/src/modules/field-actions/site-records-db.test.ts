import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import knex, { type Knex } from "knex";
import { fieldToolContext } from "./tool-context.ts";
import { siteRecordHandlers } from "./site-records.ts";
import { siteBackendHandlers } from "./site-backend-records.ts";
import type { SiteRecordKind } from "./site-records-types.ts";
import type { FieldToolInput } from "./tool-types.ts";

const url = process.env.FIELD_ACTION_TEST_DATABASE_URL ?? process.env.MESSAGING_AGENT_TEST_DATABASE_URL;

async function fixture(run: (db: Knex.Transaction, id: (name: string) => string) => Promise<void>) {
  const connection = knex({ client: "pg", connection: url }), db = await connection.transaction();
  const prefix = `site_record_${randomUUID()}`, id = (name: string) => `${prefix}_${name}`;
  try {
    await db("user").insert(["owner", "reviewer", "crew", "denied"].map((name) => ({ id: id(name), name, email: `${id(name)}@test.invalid` })));
    await db("organization").insert({ id: id("org"), name: "Site fixture", slug: id("org") });
    await db("member").insert({ id: id("owner-member"), organizationId: id("org"), userId: id("owner"), role: "owner" });
    await db("projects").insert(["site", "foreign"].map((name) => ({ id: id(name), name, address: "Fixture", status: "On Track", risk: "Low", currency: "NGN", organization_id: id("org"), owner_id: id("owner") })));
    await db("buildings").insert(["site", "foreign"].map((name) => ({ id: id(`${name}-building`), project_id: id(name), name: "Block A" })));
    await db("project_phases").insert(["site", "foreign"].map((name) => ({ id: id(`${name}-stage`), project_id: id(name), building_id: id(`${name}-building`), name: "Stage", status: "Pending" })));
    await db("project_participants").insert(["reviewer", "crew", "denied"].map((name) => ({
      id: id(`${name}-participant`), project_id: id("site"), user_id: id(name), email: `${id(name)}@test.invalid`, role: "site_agent", status: "active",
      grants: JSON.stringify({ project: ["view"], ...(name === "reviewer" ? { materials: ["approve"] } : name === "crew" ? { materials: ["request"], dailyLog: ["create"], comments: ["post"] } : {}) }),
    })));
    await db("platform_settings").insert({ id: "singleton", feature_flags: JSON.stringify({ "commercial.materialsEquipment": true, "commercial.materialsLedger": true, "commercial.transactions": true, "quality.dailyLogs": true }) }).onConflict("id").merge();
    await run(db, id);
  } finally { await db.rollback(); await connection.destroy(); }
}

function runner(db: Knex, id: (name: string) => string) {
  return async (kind: SiteRecordKind, payload: Record<string, unknown>, user = "owner") => {
    const input: FieldToolInput = { kind, projectId: id("site"), buildingId: id("site-building"), payload, idempotencyKey: randomUUID() };
    const context = await fieldToolContext(db, input, { userId: id(user), organizationId: id("org") });
    return siteRecordHandlers[kind](input, context);
  };
}

test("all sixteen site-record handlers execute through canonical services with templates, audit history, stock and costs", { skip: !url }, async () => fixture(async (db, id) => {
  const execute = runner(db, id), seen = new Set<string>();
  const call: typeof execute = async (...args) => { const result = await execute(...args); seen.add(args[0]); return result; };
  await db("daily_log_templates").insert({ id: id("template"), project_id: id("site"), name: "Crew form", fields: JSON.stringify([
    { id: "crew", type: "number", label: "Workers", required: true, unit: "workers", helpText: null, options: [] },
  ]), created_by_id: id("owner") });
  const note = await call("daily_log", { logDate: "2026-11-16", templateId: id("template"), responses: { crew: 6 }, bodyHtml: "<p>Crew on site.</p>", bodyText: "Crew on site." }, "crew");
  const diary = await db("daily_log_entries").where({ id: note.recordId }).first();
  assert.equal(diary.template_id, id("template")); assert.match(diary.body_html, /Workers/); assert.match(diary.body_text, /6/);
  await call("update_daily_log", { logDate: "2026-11-16", workersPresent: 6, totalHours: 40, summary: "Ground floor works", summaryHtml: "<p>Ground floor works</p>" }, "crew");
  await call("void_daily_log_entry", { entryId: note.recordId, reason: "Duplicate crew report" }, "crew");
  assert.equal(Number((await db("daily_log_entry_voids").where({ entry_id: note.recordId }).count("*").first())!.count), 1);
  const received = await call("material_log", { entryType: "IN", materialName: "Cement", unit: "bags", quantity: 10, stageId: id("site-stage"), reason: "Delivered today" }, "crew");
  assert.equal((await db("material_ledger_entries").where({ id: received.recordId }).first()).stage_id, id("site-stage"));
  const reversed = await call("void_ledger_entry", { entryId: received.recordId, reason: "Wrong load" });
  assert.equal((await db("material_ledger_entries").where({ id: reversed.recordId }).first()).entry_type, "VOID");
  const approval = await call("create_material_approval", { title: "Sand sample", materialName: "Sand", specification: "Washed", quantity: 5, unit: "tonne", requestedReviewerId: id("reviewer") }, "crew");
  assert.equal(Number((await db("notifications").where({ user_id: id("reviewer"), type: "approval_requested" }).count("*").first())!.count), 1);
  await call("update_material_approval", { approvalId: approval.recordId, specification: "Washed sharp sand", neededBy: "2026-11-20" }, "crew");
  await call("comment_material_approval", { approvalId: approval.recordId, body: "Sample available in the yard." }, "crew");
  await assert.rejects(call("decide_material_approval", { approvalId: approval.recordId, status: "Approved", response: "Accepted" }), /requested reviewer/);
  await call("decide_material_approval", { approvalId: approval.recordId, status: "Resubmit", response: "Provide an updated sample" }, "reviewer");
  const reopened = await call("reopen_material_approval", { approvalId: approval.recordId }, "crew");
  assert.equal(reopened.recordId, approval.recordId);
  assert.equal((await db("approvals").where({ id: approval.recordId }).first()).status, "Pending");
  await call("decide_material_approval", { approvalId: approval.recordId, status: "Approved", response: "Accepted", responseHtml: "<p>Accepted</p>" }, "reviewer");
  await assert.rejects(call("update_material_approval", { approvalId: approval.recordId, specification: "Changed" }), /cannot be changed/);
  await assert.rejects(call("delete_material_approval", { approvalId: approval.recordId }), /Only pending/);
  const replacement = await call("reopen_material_approval", { approvalId: approval.recordId, specification: "Updated sample" }, "crew");
  assert.notEqual(replacement.recordId, approval.recordId);
  assert.equal((await db("approvals").where({ id: approval.recordId }).first()).status, "Approved");
  assert.equal((await db("approvals").where({ id: replacement.recordId }).first()).resubmitted_from_id, approval.recordId);
  await call("delete_material_approval", { approvalId: replacement.recordId });
  const order = await call("material_order", { title: "Sand delivery", materialName: "Sand", quantity: 5, unit: "tonne", neededBy: "2026-11-20", phaseId: id("site-stage"), unitRate: 1000 }, "crew");
  await call("update_material_order", { orderId: order.recordId, patch: { status: "Approved" } });
  await call("update_material_order", { orderId: order.recordId, patch: { status: "Ordered" } });
  await call("receive_material_order", { orderId: order.recordId, unit: "tonnes", deliveredQty: 3, deliveredAt: "2026-11-16", deliveryNote: "DN-5" });
  await assert.rejects(call("receive_material_order", { orderId: order.recordId, unit: "m3", deliveredQty: 1, deliveredAt: "2026-11-16" }), /different unit/);
  assert.equal(Number((await db("material_deliveries").where({ order_id: order.recordId }).count("*").first())!.count), 1);
  const stored = await db("material_orders").where({ id: order.recordId }).first();
  assert.equal(stored.status, "PartiallyDelivered"); assert.equal(Number(stored.actual_cost), 3000);
  const delivery = await db("material_deliveries").where({ order_id: order.recordId }).first();
  assert.ok(delivery.ledger_entry_id); assert.ok(delivery.transaction_id);
  assert.equal(Number((await db("project_transactions").where({ id: delivery.transaction_id }).first()).amount), 3000);
  const removable = await call("material_order", { title: "Duplicate order", materialName: "Blocks", quantity: 20, unit: "each", neededBy: "2026-11-20" });
  await call("delete_material_order", { orderId: removable.recordId });
  assert.equal(await db("material_orders").where({ id: removable.recordId }).first(), undefined);
  const expense = await call("create_expense", { title: "Haulage", category: "transport", amount: 5000, currency: "NGN", transactedAt: "2026-11-16", stageId: id("site-stage"), vendor: "Haulier", credit: true, recoverable: true });
  const transaction = await db("project_transactions").where({ id: expense.recordId }).first();
  assert.equal(transaction.created_by_id, id("owner")); assert.equal(transaction.credit, true); assert.equal(transaction.recoverable, true);
  assert.deepEqual([...seen].sort(), Object.keys(siteRecordHandlers).sort());
}));

test("site records deny all sixteen actions without current grants and validate state, record scope, references and attachments", { skip: !url }, async () => fixture(async (db, id) => {
  const execute = runner(db, id);
  const payloads: Record<SiteRecordKind, Record<string, unknown>> = {
    daily_log: { logDate: "2026-11-16", bodyText: "Note" }, update_daily_log: { logDate: "2026-11-16", totalHours: 3 },
    void_daily_log_entry: { entryId: "unavailable", reason: "Duplicate" }, material_log: { entryType: "IN", materialName: "Sand", quantity: 2, unit: "tonne" },
    void_ledger_entry: { entryId: "unavailable", reason: "Duplicate" }, material_order: { title: "Sand", materialName: "Sand", quantity: 2, unit: "tonne", neededBy: "2026-11-20" },
    update_material_order: { orderId: "unavailable", patch: { title: "Amended" } }, delete_material_order: { orderId: "unavailable" },
    receive_material_order: { orderId: "unavailable", unit: "tonne", deliveredQty: 2, deliveredAt: "2026-11-16" },
    create_material_approval: { title: "Sand", materialName: "Sand" }, update_material_approval: { approvalId: "unavailable", specification: "Sharp" },
    decide_material_approval: { approvalId: "unavailable", status: "Approved" }, reopen_material_approval: { approvalId: "unavailable" },
    delete_material_approval: { approvalId: "unavailable" }, comment_material_approval: { approvalId: "unavailable", body: "Check this" },
    create_expense: { title: "Haulage", category: "transport", amount: 5000, currency: "NGN", transactedAt: "2026-11-16" },
  };
  for (const kind of Object.keys(payloads) as SiteRecordKind[]) await assert.rejects(execute(kind, payloads[kind], "denied"), /role|permission/);
  await assert.rejects(execute("material_order", { ...payloads.material_order, status: "Approved" }, "crew"), /approve/);
  await assert.rejects(execute("material_order", { ...payloads.material_order, phaseId: id("foreign-stage") }), /Stage does not belong/);
  await assert.rejects(execute("create_material_approval", { ...payloads.create_material_approval, requestedReviewerId: id("denied-outside") }), /access|permission/);
  await assert.rejects(execute("material_log", { ...payloads.material_log, quantity: 0.001 }), /two decimal/);
  await assert.rejects(execute("material_log", { ...payloads.material_log, fileIds: [id("missing-file")] }), /Attachment/);
  await assert.rejects(execute("create_expense", { ...payloads.create_expense, stageId: id("foreign-stage") }), /Stage does not belong/);
  await assert.rejects(execute("create_expense", { ...payloads.create_expense, category: "unknown-category" }), /Unknown category/);
  const order = await execute("material_order", payloads.material_order);
  await assert.rejects(execute("receive_material_order", { orderId: order.recordId, unit: "tonne", deliveredQty: 2, deliveredAt: "2026-11-16" }), /cannot receive/);
  await db("platform_settings").where({ id: "singleton" }).update({ feature_flags: JSON.stringify({ "commercial.materialsEquipment": false, "commercial.transactions": false, "quality.dailyLogs": false }) });
  for (const kind of ["material_log", "material_order", "create_expense", "daily_log"] as const) await assert.rejects(execute(kind, payloads[kind]), /disabled/);
}));

test("site actions roll back orders, stock, delivery costs and approval notifications with their caller transaction", { skip: !url }, async () => fixture(async (db, id) => {
  await assert.rejects(db.transaction(async (transaction) => {
    const execute = runner(transaction, id);
    const order = await execute("material_order", { title: "Ordered sand", materialName: "Sand", quantity: 2, unit: "tonne", neededBy: "2026-11-20", status: "Ordered", unitRate: 500 });
    await execute("receive_material_order", { orderId: order.recordId, unit: "tonne", deliveredQty: 2, deliveredAt: "2026-11-16" });
    await execute("create_material_approval", { title: "Review cement", materialName: "Cement", requestedReviewerId: id("reviewer") });
    throw new Error("Action receipt failed");
  }), /receipt failed/);
  for (const table of ["material_orders", "material_deliveries", "material_ledger_entries", "project_transactions", "approvals", "notifications"]) {
    assert.equal(Number((await db(table).where({ project_id: id("site") }).count("*").first())!.count), 0, table);
  }
}));

test("expense confirmation binds the stated currency to the current locked project without converting the amount", { skip: !url }, async () => fixture(async (db, id) => {
  const execute = runner(db, id), payload = { title: "Fuel", category: "materials", amount: 100, currency: "USD", transactedAt: "2026-11-16" };
  const input: FieldToolInput = { kind: "create_expense", projectId: id("site"), buildingId: id("site-building"), payload: { ...payload, currency: "NGN" }, idempotencyKey: randomUUID() };
  const stale = await fieldToolContext(db, input, { userId: id("owner"), organizationId: id("org") });
  const statements: string[] = [], watch = (query: Knex.Sql) => statements.push(query.sql);
  db.on("query", watch);
  try { await assert.rejects(execute("create_expense", payload), /currency differs/); }
  finally { db.removeListener("query", watch); }
  assert.ok(statements.some((sql) => /for share/i.test(sql)), "currency comparison holds a project row lock until confirmation commits");
  assert.ok(!statements.some((sql) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql)), "a conflicting currency cannot write any domain record");
  await db("projects").where({ id: id("site") }).update({ currency: "USD" });
  statements.length = 0; db.on("query", watch);
  try { await assert.rejects(siteRecordHandlers.create_expense(input, stale), /currency differs/); }
  finally { db.removeListener("query", watch); }
  assert.ok(!statements.some((sql) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql)), "stale authorization context cannot supply the old currency");
  const result = await execute("create_expense", payload);
  assert.deepEqual(result.data, { amount: 100, currency: "USD" });
  const saved = await db("project_transactions").where({ id: result.recordId }).first();
  assert.equal(Number(saved.amount), 100);
  assert.equal(Number((await db("project_transactions").where({ project_id: id("site") }).count("*").first())!.count), 1);
}));

test("a standalone activity delay never invents hours or creates a diary and preserves canonical EOT and scope rules", { skip: !url }, async () => fixture(async (db, id) => {
  await db("activities").insert(["site", "foreign"].map((name) => ({ id: id(`${name}-activity`), project_id: id(name), building_id: id(`${name}-building`), phase_id: id(`${name}-stage`), name: "Concrete pour", activity_type: "Concrete", planned_start_at: "2026-11-14", planned_end_at: "2026-11-16" })));
  const input: FieldToolInput = { kind: "raise_activity_delay", projectId: id("site"), buildingId: id("site-building"), idempotencyKey: randomUUID(), payload: {
    activityId: id("site-activity"), reasonCode: "EQUIPMENT_BREAKDOWN", startedAt: "2026-11-15T08:00:00Z", description: "Pump stopped", culpability: "contractor", eotClaimable: true,
  } };
  const execute = async (value = input, user = "owner") => siteBackendHandlers.raise_activity_delay(value,
    await fieldToolContext(db, value, { userId: id(user), organizationId: id("org") }));
  await assert.rejects(execute(input, "crew"), /permission|role/);
  await assert.rejects(execute({ ...input, payload: { ...input.payload, activityId: id("foreign-activity") } }), /Activity/);
  await assert.rejects(execute({ ...input, payload: { ...input.payload, hoursLogged: 0 } }), /additional properties/);
  const result = await execute();
  const delay = await db("activity_delays").where({ id: result.recordId }).first();
  assert.equal(delay.activity_id, id("site-activity")); assert.equal(delay.eot_claimable, false);
  assert.equal(Number((await db("daily_logs").where({ project_id: id("site") }).count("*").first())!.count), 0);
}));
