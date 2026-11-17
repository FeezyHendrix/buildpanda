import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import knex, { type Knex } from "knex";
import { materialLedgerExecutor } from "./material-log.ts";
import type { MaterialLogCommand } from "./material-types.ts";
import { buildMaterialsLedgerService } from "../materials-ledger/wiring.ts";
import { materialLedgerNotificationQueue } from "../materials-ledger/notification-queue.ts";

const url = process.env.FIELD_ACTION_TEST_DATABASE_URL ?? process.env.MESSAGING_AGENT_TEST_DATABASE_URL;

test("material external notifications wait for every transaction commit and skip explicit or nested rollbacks", { skip: !url }, async () => {
  const db = knex({ client: "pg", connection: url }), calls: string[] = [];
  const queue = { async enqueue(_queue: string, name: string) { calls.push(name); } };
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
  try {
    await db.transaction(async (transaction) => {
      await materialLedgerNotificationQueue(transaction, queue)!.enqueue("notifications", "committed", {});
      assert.deepEqual(calls, []);
    });
    await flush(); assert.deepEqual(calls, ["committed"]); calls.length = 0;
    const rolledBack = await db.transaction();
    await materialLedgerNotificationQueue(rolledBack, queue)!.enqueue("notifications", "rolled-back", {});
    await rolledBack.rollback(); await flush(); assert.deepEqual(calls, []);
    const outer = await db.transaction();
    await outer.transaction(async (child) => {
      await materialLedgerNotificationQueue(child, queue)!.enqueue("notifications", "nested-commit", {});
      assert.deepEqual(calls, []);
    });
    await flush(); assert.deepEqual(calls, []);
    await outer.commit(); await flush(); assert.deepEqual(calls, ["nested-commit"]); calls.length = 0;
    const root = await db.transaction(), child = await root.transaction();
    await materialLedgerNotificationQueue(child, queue)!.enqueue("notifications", "nested-rollback", {});
    await child.rollback(); await root.commit(); await flush(); assert.deepEqual(calls, []);
  } finally { await db.destroy(); }
});

async function fixture(run: (db: Knex.Transaction, id: (name: string) => string) => Promise<void>) {
  const connection = knex({ client: "pg", connection: url });
  const db = await connection.transaction(), prefix = `material_action_${randomUUID()}`;
  const id = (name: string) => `${prefix}_${name}`;
  try {
    await db("user").insert(["owner", "crew", "denied"].map((name) => ({ id: id(name), name, email: `${id(name)}@test.invalid` })));
    await db("organization").insert({ id: id("org"), name: "Material fixture", slug: id("org") });
    await db("member").insert({ id: id("owner-member"), organizationId: id("org"), userId: id("owner"), role: "owner" });
    await db("projects").insert(["site", "foreign"].map((name) => ({ id: id(name), name, address: "Fixture", status: "On Track", risk: "Low", currency: "NGN", organization_id: id("org"), owner_id: id("owner") })));
    await db("buildings").insert({ id: id("building"), project_id: id("site"), name: "Block A" });
    await db("project_participants").insert(["crew", "denied"].map((name) => ({
      id: id(`${name}-participant`), project_id: id("site"), user_id: id(name), email: `${id(name)}@test.invalid`, role: "site_agent", status: "active",
      grants: JSON.stringify(name === "crew" ? { project: ["view"], materials: ["request"] } : {}),
    })));
    await db("platform_settings").insert({ id: "singleton", feature_flags: JSON.stringify({ "commercial.materialsLedger": true }) }).onConflict("id").merge();
    await run(db, id);
  } finally { await db.rollback(); await connection.destroy(); }
}

test("confirmed material receipts post stock once, preserve source notes and obey current material grants", { skip: !url }, async () => fixture(async (db, id) => {
  const actor = { userId: id("crew"), organizationId: id("org") }, executor = materialLedgerExecutor(db);
  const reason = "Expected last week.\n\nReceived today — 20 tonnes of sand.";
  const input: MaterialLogCommand = { kind: "material_log", projectId: id("site"), payload: {
    entryType: "IN", materialName: "Sand", unit: "tonnes", quantity: 20,
    occurredAt: "2026-11-16T12:17:40+01:00", supplier: "Site supplier", deliveryNote: "DN-17", reason, idempotencyKey: id("receipt"),
  } };
  const saved = await executor.execute(input, actor), duplicate = await executor.execute(input, actor);
  assert.equal(saved.duplicate, false); assert.equal(duplicate.duplicate, true); assert.equal(saved.recordId, duplicate.recordId);
  const ledger = buildMaterialsLedgerService(db), entries = await ledger.listLedger(input.projectId, {});
  assert.equal(entries.length, 1); assert.equal(entries[0]!.entryType, "IN"); assert.equal(entries[0]!.quantity, 20);
  assert.equal(entries[0]!.unit, "tonne"); assert.equal(entries[0]!.reason, reason);
  assert.equal(entries[0]!.notesHtml, "<p>Expected last week.<br /><br />Received today — 20 tonnes of sand.</p>");
  assert.equal(entries[0]!.supplier, "Site supplier"); assert.equal(entries[0]!.deliveryNote, "DN-17");
  assert.equal(entries[0]!.loggedById, actor.userId); assert.equal(entries[0]!.approvalStatus, "Approved");
  assert.equal(new Date(entries[0]!.occurredAt).getTime(), new Date(input.payload.occurredAt!).getTime());
  assert.equal((await ledger.getStock(input.projectId))[0]!.onHandQty, 20);
  assert.equal(Number((await db("daily_log_entries").where({ project_id: input.projectId }).count("*").first())!.count), 0);
  await assert.rejects(executor.execute({ ...input, payload: { ...input.payload, entryType: "USED", idempotencyKey: id("usage") } }, actor), /role does not allow/);
  await assert.rejects(executor.execute(input, { ...actor, userId: id("denied") }), /role does not allow/);
  await assert.rejects(executor.execute(input, { ...actor, organizationId: "other-workspace" }), /another workspace/);
  await assert.rejects(executor.execute({ ...input, projectId: id("foreign") }, actor), /access|permission/i);
  await db("project_participants").where({ id: id("crew-participant") }).update({ grants: JSON.stringify({ project: ["view"], materials: [] }) });
  await assert.rejects(executor.execute(input, actor), /role does not allow/);
}));

test("material movement and reconciliation side effects share the caller transaction", { skip: !url }, async () => fixture(async (db, id) => {
  const actor = { userId: id("crew"), organizationId: id("org") }, executor = materialLedgerExecutor(db);
  await db("project_participants").where({ id: id("crew-participant") }).update({ grants: JSON.stringify({ project: ["view"], materials: ["manage"] }) });
  const receipt: MaterialLogCommand = { kind: "material_log", projectId: id("site"), payload: { entryType: "IN", materialName: "Cement", unit: "bag", quantity: 10, idempotencyKey: id("in") } };
  await executor.execute(receipt, actor);
  await assert.rejects(db.transaction(async (transaction) => {
    await materialLedgerExecutor(transaction).execute({ ...receipt, payload: { ...receipt.payload, quantity: 3, idempotencyKey: id("rollback") } }, actor);
    throw new Error("Fail the action receipt after the stock write");
  }), /action receipt/);
  const service = buildMaterialsLedgerService(db), stock = (await service.getStock(receipt.projectId))[0]!;
  assert.equal(stock.onHandQty, 10);
  await service.updateReorderPolicy(receipt.projectId, stock.materialId, { lowStockThreshold: 5, reorderQuantity: 10, autoReorderEnabled: true });
  const usage: MaterialLogCommand = { ...receipt, payload: { ...receipt.payload, entryType: "USED", quantity: 12, idempotencyKey: id("used") } };
  const used = await executor.execute(usage, actor); assert.equal(used.onHandQty, -2);
  assert.equal(Number((await db("tasks").where({ project_id: receipt.projectId, source_type: "material_reconciliation" }).count("*").first())!.count), 1);
  assert.equal(Number((await db("material_orders").where({ project_id: receipt.projectId, status: "Requested" }).count("*").first())!.count), 1);
  assert.equal(Number((await db("notifications").where({ project_id: receipt.projectId }).whereIn("type", ["material_negative_stock", "material_low_stock", "material_reorder_created"]).count("*").first())!.count), 3);
  await executor.execute(usage, actor);
  assert.equal((await service.getStock(receipt.projectId))[0]!.onHandQty, -2);
  assert.equal(Number((await db("material_orders").where({ project_id: receipt.projectId }).count("*").first())!.count), 1);
}));

test("canonical order auto-linking preserves matching units and rejects implicit quantity conversions", { skip: !url }, async () => fixture(async (db, id) => {
  const actor = { userId: id("crew"), organizationId: id("org") }, executor = materialLedgerExecutor(db);
  await db("material_orders").insert({ id: id("order"), project_id: id("site"), title: "Expected sand", material_name: "Sand", quantity: "30", unit: "m3", status: "Ordered", priority: "Normal", requested_by_id: id("owner"), needed_by: "2026-11-09" });
  const input: MaterialLogCommand = { kind: "material_log", projectId: id("site"), payload: { entryType: "IN", materialName: "Sand", unit: "tonnes", quantity: 20, idempotencyKey: id("receipt") } };
  await assert.rejects(executor.execute(input, actor), (error: Error) => {
    assert.match(error.message, /order's unit/);
    assert.ok(!error.message.includes("m3"), "a request-only receipt cannot disclose the matched order's unit");
    return true;
  });
  assert.equal(Number((await db("material_ledger_entries").where({ project_id: input.projectId }).count("*").first())!.count), 0);
  assert.equal(Number((await db("materials_catalog").where({ project_id: input.projectId }).count("*").first())!.count), 0);
  await db("material_orders").where({ id: id("order") }).update({ unit: "tonne" });
  const result = await executor.execute(input, actor);
  const row = await db("material_ledger_entries").where({ id: result.recordId }).first();
  assert.equal(row.material_order_id, id("order")); assert.equal(Number(row.quantity), 20); assert.equal(row.unit_snapshot, "tonne");
  const service = buildMaterialsLedgerService(db);
  await assert.rejects(service.logEntry(input.projectId, { ...input.payload, unit: "m3", materialOrderId: id("order"), idempotencyKey: id("explicit") }, actor.userId), /order's unit/);
}));
