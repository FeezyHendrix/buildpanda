import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import knex, { type Knex } from "knex";
import { fieldToolsExecutor } from "./tools.ts";
import { fieldToolContext } from "./tool-context.ts";
import { requireFileRead } from "../files/access.ts";
import { fileAccessRepository } from "../files/access-repository.ts";
import { filesRepository } from "../files/repository.ts";
import { messagingReviewVisibility } from "../messaging-agent/review-access.ts";
import { messagingAgentAccess } from "../messaging-agent/access.ts";
import { messagingToolDiscovery } from "../messaging-agent/tool-discovery.ts";

const url = process.env.FIELD_ACTION_TEST_DATABASE_URL ?? process.env.MESSAGING_AGENT_TEST_DATABASE_URL;
async function fixture(run: (db: Knex.Transaction, id: (name: string) => string) => Promise<void>) {
  const connection = knex({ client: "pg", connection: url }), db = await connection.transaction();
  const prefix = `intake_${randomUUID()}`, id = (name: string) => `${prefix}_${name}`;
  try {
    await db("user").insert(["owner", "crew"].map((name) => ({ id: id(name), name, email: `${id(name)}@test.invalid` })));
    await db("organization").insert({ id: id("org"), name: "Intake", slug: id("org") });
    await db("member").insert({ id: id("membership"), organizationId: id("org"), userId: id("owner"), role: "owner" });
    await db("projects").insert(["site", "foreign"].map((name) => ({ id: id(name), name, address: "Fixture", status: "On Track", risk: "Low", currency: "NGN", organization_id: id("org"), owner_id: id("owner") })));
    await db("project_participants").insert({ id: id("crew-participant"), project_id: id("site"), user_id: id("crew"), email: `${id("crew")}@test.invalid`, role: "site_agent", status: "active",
      grants: JSON.stringify({ project: ["view"], finances: ["view", "viewCosts", "manage"] }) });
    await db("uploaded_files").insert(["po", "invoice", "payment", "delivery", "crew-receipt", "crew-other", "foreign-file", "same-payment"].map((name) => ({
      id: id(name), project_id: id(name === "foreign-file" ? "foreign" : "site"), owner_id: id(name.startsWith("crew") ? "crew" : "owner"), file_name: `${name}.pdf`, mime_type: "application/pdf", size_bytes: 20, storage_path: `fixture/${name}`,
      content_sha256: name === "same-payment" ? "payment-hash" : `${name}-hash`,
    })));
    await db("platform_settings").insert({ id: "singleton", feature_flags: JSON.stringify({ "commercial.transactions": true, "commercial.invoices": true, "commercial.purchaseOrders": true, "projects.documents": true }) }).onConflict("id").merge();
    await run(db, id);
  } finally { await db.rollback(); await connection.destroy(); }
}
function runner(db: Knex, id: (name: string) => string) {
  return (kind: string, payload: Record<string, unknown>, actor = "owner", project = "site") => fieldToolsExecutor(db).execute({ kind, projectId: id(project), buildingId: null, payload, idempotencyKey: randomUUID() }, { userId: id(actor), organizationId: id("org") });
}
const day = "2026-11-24";

test("PO imports stay drafts, issue and receive require approval, partial deliveries keep their evidence", { skip: !url }, async () => fixture(async (db, id) => {
  const call = runner(db, id), body = { vendorName: "ABC", poNumber: "EXTERNAL-45", currency: "NGN", sourceFileId: id("po"), items: [{ description: "Cement", quantity: 5, unitPrice: 3000 }] };
  const po = await call("create_purchase_order", body);
  const row = await db("purchase_orders").where({ id: po.recordId }).first();
  assert.equal(row.status, "Draft"); assert.equal(row.po_number, "EXTERNAL-45"); assert.equal(row.source_file_id, id("po"));
  await assert.rejects(call("create_purchase_order", body), /already belongs/);
  await assert.rejects(call("create_purchase_order", { ...body, sourceFileId: id("invoice"), currency: "USD" }), /currency|NGN/);
  await assert.rejects(call("issue_purchase_order", { purchaseOrderId: po.recordId, issuedAt: day }, "crew"), /does not allow|permission/i);
  await call("issue_purchase_order", { purchaseOrderId: po.recordId, issuedAt: day });
  const line = await db("purchase_order_items").where({ purchase_order_id: po.recordId }).first();
  await call("receive_purchase_order", { purchaseOrderId: po.recordId, sourceFileId: id("delivery"), lines: [{ itemId: line.id, receivedQuantity: 2 }] });
  assert.equal((await db("purchase_orders").where({ id: po.recordId }).first()).status, "PartiallyReceived");
  assert.equal(Number((await db("purchase_order_items").where({ id: line.id }).first()).received_quantity), 2);
  assert.ok(await db("purchase_order_receipt_files").where({ purchase_order_id: po.recordId, file_id: id("delivery"), created_by_id: id("owner") }).first());
  await assert.rejects(call("receive_purchase_order", { purchaseOrderId: po.recordId, sourceFileId: id("delivery"), lines: [{ itemId: line.id, receivedQuantity: 4 }] }), /already attached/);
  await assert.rejects(call("create_purchase_order", { ...body, sourceFileId: id("foreign-file") }), /another project/);
}));

test("supplier invoices stay unpaid and payments use approval rules, direction, balance and duplicate evidence guards", { skip: !url }, async () => fixture(async (db, id) => {
  const call = runner(db, id), body = { vendorName: "ABC", trade: "Cement", number: "INV-123", currency: "NGN", sourceFileId: id("invoice"), lineItems: [{ description: "Cement", quantity: 5, unitRate: 3000 }], vatRate: 0, whtRate: 0, retentionRate: 0 };
  const invoice = await call("create_supplier_invoice", body);
  const row = await db("project_invoices").where({ id: invoice.recordId }).first();
  assert.equal(row.status, "Draft"); assert.equal(row.direction, "payable"); assert.equal(row.source_file_id, id("invoice"));
  await assert.rejects(call("create_supplier_invoice", body), /already uses/);
  const payment = { invoiceId: invoice.recordId, amount: 5000, paidAt: day, direction: "payable", currency: "NGN", sourceFileId: id("payment") };
  await assert.rejects(call("record_invoice_payment", payment), /issued|approved/);
  await db("project_invoices").where({ id: invoice.recordId }).update({ status: "Approved" });
  await assert.rejects(call("record_invoice_payment", { ...payment, direction: "receivable" }), /direction/);
  await assert.rejects(call("record_invoice_payment", payment, "crew"), /does not allow|permission/i);
  const result = await call("record_invoice_payment", payment);
  assert.equal(result.data?.balanceDue, 10000);
  await assert.rejects(call("create_expense", { title: "Duplicate cement", category: "materials", currency: "NGN", amount: 5000, transactedAt: day, receiptFileId: id("payment") }), /invoice payment/);
  const stored = await db("invoice_payments").where({ invoice_id: invoice.recordId }).first();
  assert.equal(stored.source_file_id, id("payment")); assert.equal(stored.recorded_by_id, id("owner"));
  await assert.rejects(call("record_invoice_payment", { ...payment, sourceFileId: id("same-payment") }), /already records/);
  assert.equal(Number((await db("project_transactions").where({ project_id: id("site") }).count("*").first())!.count), 0);
}));

test("receipt attachment preserves expense visibility, does not add spend, and rejects replacing evidence", { skip: !url }, async () => fixture(async (db, id) => {
  const call = runner(db, id), body = { title: "Fuel for site generator", category: "miscellaneous", currency: "NGN", amount: 5000, transactedAt: day };
  const own = await call("create_expense", body, "crew"), privateExpense = await call("create_expense", body);
  await assert.rejects(call("attach_expense_receipt", { expenseId: privateExpense.recordId, receiptFileId: id("crew-receipt") }, "crew"), /not found/i);
  await call("attach_expense_receipt", { expenseId: own.recordId, receiptFileId: id("crew-receipt") }, "crew");
  await assert.rejects(call("attach_expense_receipt", { expenseId: own.recordId, receiptFileId: id("crew-other") }, "crew"), /already has a receipt/);
  await assert.rejects(call("create_expense", { ...body, receiptFileId: id("crew-receipt") }, "crew"), /already uses/);
  assert.equal(Number((await db("project_transactions").where({ project_id: id("site") }).count("*").first())!.count), 2);
  const access = await messagingAgentAccess(db).project(id("crew"), id("site"));
  const options = await messagingToolDiscovery(db, access, { projectId: id("site"), organizationId: id("org"), buildingId: null });
  assert.deepEqual((options.targets.expenses as { value: string }[]).map((row) => row.value), [own.recordId]);
  const context = await fieldToolContext(db, { kind: "attach_expense_receipt", projectId: id("site"), buildingId: null, payload: {}, idempotencyKey: randomUUID() }, { userId: id("crew"), organizationId: id("org") });
  await requireFileRead(context.request, (await filesRepository(db).findById(id("crew-receipt")))!, fileAccessRepository(db));
  await db("project_participants").where({ id: id("crew-participant") }).update({ grants: JSON.stringify({ project: ["view"], finances: ["view"] }) });
  await assert.rejects(call("attach_expense_receipt", { expenseId: own.recordId, receiptFileId: id("crew-receipt") }, "crew"), /does not allow|permission/i);
  const denied = await messagingAgentAccess(db).project(id("crew"), id("site"));
  assert.deepEqual(await messagingReviewVisibility(db, denied, { projectId: id("site"), organizationId: id("org"), buildingId: null }, [{ kind: "create_purchase_order", payload: {}, result: { recordId: "foreign-po" } }]), [false]);
  const deniedContext = await fieldToolContext(db, { kind: "read", projectId: id("site"), buildingId: null, payload: {}, idempotencyKey: randomUUID() }, { userId: id("crew"), organizationId: id("org") });
  await assert.rejects(requireFileRead(deniedContext.request, (await filesRepository(db).findById(id("crew-receipt")))!, fileAccessRepository(db)), /permission/);
}));
