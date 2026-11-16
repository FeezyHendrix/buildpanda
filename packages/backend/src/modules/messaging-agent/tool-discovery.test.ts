import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { voiceActions } from "@buildpanda/voice-actions";
import knex, { type Knex } from "knex";
import { buildTools } from "../panda-ai/agent/tools.ts";
import { fieldToolHandlers } from "../field-actions/tools.ts";
import { fieldToolSchemas } from "../field-actions/tools.ts";
import { FEATURE_FLAGS } from "../feature-flags/definitions.ts";
import { invoicesRepository } from "../invoices/repository.ts";
import { invoicesService } from "../invoices/service.ts";
import { messagingAgentAccess } from "./access.ts";
import { messagingAgentRepository } from "./repository.ts";
import { messagingToolDiscovery } from "./tool-discovery.ts";
import { MESSAGING_READ_TOOLS } from "./tool-discovery-policy.ts";

const url = process.env.MESSAGING_AGENT_TEST_DATABASE_URL;

test("the messaging read allowlist explicitly covers 45 project reads plus 15 full-record reads and excludes every write/navigation tool", () => {
  assert.equal(MESSAGING_READ_TOOLS.size, 60);
  const expected = buildTools().map((entry) => entry.spec.function.name).filter((name) => !["create_task", "create_rfi", "navigate"].includes(name));
  assert.deepEqual([...MESSAGING_READ_TOOLS].sort(), expected.sort());
});

async function fixture(run: (db: Knex.Transaction, id: (name: string) => string) => Promise<void>) {
  const connection = knex({ client: "pg", connection: url }), db = await connection.transaction();
  const prefix = `tool_discovery_${randomUUID()}`, id = (name: string) => `${prefix}_${name}`;
  try {
    await db("user").insert(["owner", "crew"].map((name) => ({ id: id(name), name, email: `${id(name)}@test.invalid` })));
    await db("organization").insert({ id: id("org"), name: "Discovery fixture", slug: id("org") });
    await db("member").insert({ id: id("member"), organizationId: id("org"), userId: id("owner"), role: "owner" });
    await db("projects").insert(["site", "foreign"].map((name) => ({ id: id(name), name, address: "Fixture", status: "On Track", risk: "Low", currency: "NGN", organization_id: id("org"), owner_id: id("owner") })));
    await db("buildings").insert({ id: id("building"), project_id: id("site"), name: "Block A" });
    await db("project_finances").insert({ project_id: id("site"), currency: "NGN", contract_sum: 1000000 });
    await db("project_participants").insert({ id: id("participant"), project_id: id("site"), user_id: id("crew"), email: `${id("crew")}@test.invalid`, role: "site_agent", status: "active",
      grants: JSON.stringify({ project: ["view"], buildings: ["view"], rfis: ["view", "manage"], tasks: ["view"], finances: ["viewCosts"], dailyLog: ["view"], schedule: ["view"] }) });
    await db("rfis").insert([
      { id: id("private-rfi"), number: 1, subject: "Culvert private", status: "Open", visibility: "internal" },
      { id: id("shared-rfi"), number: 2, subject: "Culvert shared", status: "Open", visibility: "shared" },
      { id: id("closed-rfi"), number: 3, subject: "Culvert closed", status: "Closed", visibility: "shared" },
    ].map((row) => ({ ...row, project_id: id("site"), question: "Confirm construction detail", created_by_id: id("owner") })));
    await db("task_boards").insert({ id: id("board"), project_id: id("site"), building_id: id("building"), name: "Tasks" });
    await db("task_columns").insert({ id: id("column"), board_id: id("board"), name: "To do", status: "Todo" });
    await db("tasks").insert(["owner", "crew"].map((name) => ({ id: id(`${name}-task`), project_id: id("site"), building_id: id("building"), board_id: id("board"), column_id: id("column"), title: `${name} task`, created_by_id: id(name) })));
    await db("project_transactions").insert(["owner", "crew"].map((name) => ({ id: id(`${name}-expense`), project_id: id("site"), title: `${name} expense`, category: "materials", category_type: "preset", amount: 100, transacted_at: "2026-11-16", created_by_id: id(name) })));
    await db("project_documents").insert(["site", "foreign"].map((name) => ({ id: id(`${name}-doc`), project_id: id(name), file_name: `${name}.pdf`, size: "0 B", status: "Pending", uploaded_at: "2026-11-16" })));
    await db("project_updates").insert({ id: id("update"), project_id: id("site"), author_id: id("owner"), author_name: "Owner", author_role: "Owner", category: "Progress", title: "Site update", description: "Work continues", cta_label: "View", cta_tone: "primary", is_draft: false });
    await db("platform_settings").insert({ id: "singleton", feature_flags: JSON.stringify(Object.fromEntries(FEATURE_FLAGS.map((flag) => [flag.key, true]))) }).onConflict("id").merge();
    await run(db, id);
  } finally { await db.rollback(); await connection.destroy(); }
}

test("discovery exposes the shared 52 actions plus every backend extension and runs allowed reads without writing a record", { skip: !url }, async () => fixture(async (db, id) => {
  const scope = { projectId: id("site"), organizationId: id("org"), buildingId: id("building") };
  const access = await messagingAgentAccess(db).project(id("owner"), scope.projectId);
  const writes: string[] = [], watch = (query: Knex.Sql) => { if (/^\s*(insert|update|delete)\b/i.test(query.sql)) writes.push(query.sql); };
  db.on("query", watch);
  try {
    const discovery = await messagingToolDiscovery(db, access, scope);
    assert.equal(discovery.tools.length, Object.keys(fieldToolHandlers).length); assert.equal(discovery.reads.length, 60);
    assert.ok(Object.keys(voiceActions).every((kind) => discovery.tools.some((tool) => tool.kind === kind)));
    assert.ok(discovery.tools.some((tool) => tool.kind === "raise_activity_delay"));
    assert.ok((discovery.targets.rfis as { id: string }[]).some((row) => row.id === id("closed-rfi")));
    for (const entry of discovery.reads) {
      const values: Record<string, unknown> = { term: "Culvert", documentId: id("site-doc"), updateId: id("update") };
      const args = Object.fromEntries(((entry.parameters.required as string[] | undefined) ?? []).map((key) => { assert.ok(Object.hasOwn(values, key), key); return [key, values[key]]; }));
      if (entry.name === "read_drawing") args.documentId = id("site-doc");
      await discovery.runRead(entry.name, args);
    }
    assert.equal(discovery.executedReads.length, 60);
    assert.deepEqual(writes, []);
    assert.equal(Number((await db("project_contracts").where({ project_id: scope.projectId }).count("*").first())!.count), 0);
    await assert.rejects(discovery.runRead("create_task", { title: "Must never run" }), /not available/);
    await assert.rejects(discovery.runRead("create_rfi", { subject: "Must never run" }), /not available/);
    await assert.rejects(discovery.runRead("navigate", { target: "tasks" }), /not available/);
    await assert.rejects(discovery.runRead("get_tasks", { arbitrary: "ignored" }), /additional properties/);
    await assert.rejects(discovery.runRead("analyze_document", { documentId: id("foreign-doc") }), /Document/);
    assert.deepEqual(writes, []);
  } finally { db.removeListener("query", watch); }
}));

test("discovery and composite reads preserve shared RFI visibility, own task/expense scope, feature flags and fresh access", { skip: !url }, async () => fixture(async (db, id) => {
  const scope = { projectId: id("site"), organizationId: id("org"), buildingId: id("building") };
  const access = await messagingAgentAccess(db).project(id("crew"), scope.projectId), discovery = await messagingToolDiscovery(db, access, scope);
  assert.ok(!JSON.stringify(discovery.targets.rfis).includes("private"));
  assert.ok(JSON.stringify(discovery.targets.rfis).includes("closed-rfi"));
  assert.ok(JSON.stringify(discovery.targets.options).includes("crew task"));
  assert.ok(!JSON.stringify(discovery.targets.options).includes("owner task"));
  for (const name of ["find_work_records", "get_open_items"]) {
    const output = JSON.stringify(await discovery.runRead(name, name === "find_work_records" ? { term: "Culvert" } : {}));
    assert.ok(output.includes("shared")); assert.ok(!output.includes("private"));
  }
  const tasks = JSON.stringify(await discovery.runRead("get_tasks", {}));
  assert.ok(tasks.includes("crew task")); assert.ok(!tasks.includes("owner task"));
  const expenses = JSON.stringify(await discovery.runRead("list_transactions", {}));
  assert.ok(expenses.includes("crew expense")); assert.ok(!expenses.includes("owner expense"));
  await db("platform_settings").where({ id: "singleton" }).update({ feature_flags: JSON.stringify({ "workflow.rfis": false }) });
  await assert.rejects(discovery.runRead("find_work_records", { term: "Culvert" }), /access changed/);
  const current = await messagingAgentAccess(db).project(id("crew"), scope.projectId);
  const masked = await (await messagingToolDiscovery(db, current, scope)).runRead("find_work_records", { term: "Culvert" });
  assert.ok(!JSON.stringify(masked).includes("Culvert shared"));
  await db("project_participants").where({ id: id("participant") }).update({ grants: JSON.stringify({ project: ["view"] }) });
  await assert.rejects(discovery.runRead("get_tasks", {}), /permissions|enabled field tools/);
  await assert.rejects(messagingToolDiscovery(db, access, { ...scope, organizationId: "another-workspace" }), /workspace|enabled field tools/);
}));

test("a read cannot gain company-only RFI visibility halfway through a planning turn", { skip: !url }, async () => fixture(async (db, id) => {
  const scope = { projectId: id("site"), organizationId: id("org"), buildingId: null };
  const discovery = await messagingToolDiscovery(db, await messagingAgentAccess(db).project(id("crew"), scope.projectId), scope);
  await db("member").insert({ id: id("new-member"), organizationId: id("org"), userId: id("crew"), role: "viewer" });
  await assert.rejects(discovery.runRead("get_open_items", {}), /access changed/);
  assert.deepEqual(discovery.executedReads, []);
}));

test("contract reads use invoice truth: proposed advances remain distinct from receipts and only approved live receivable work is certified", { skip: !url }, async () => fixture(async (db, id) => {
  const invoices = invoicesService(invoicesRepository(db)), projectId = id("site");
  await db("project_finances").where({ project_id: projectId }).update({ retention_rate: 0.05, retention_held: 9999, advance_percentage: 0.3, advance_recovery_rate: 0.2 });
  const draftAdvance = await invoices.create(projectId, { vendorName: "Employer", trade: "Advance", direction: "receivable", invoiceType: "advance", status: "Draft", vatRate: 0, whtRate: 0,
    lineItems: [{ description: "Proposed advance", quantity: 1, unitRate: 1000 }] });
  const paidAdvance = await invoices.create(projectId, { vendorName: "Employer", trade: "Advance", direction: "receivable", invoiceType: "advance", status: "Approved", vatRate: 0, whtRate: 0,
    lineItems: [{ description: "Agreed advance", quantity: 1, unitRate: 2000 }] });
  await db("invoice_payments").insert({ id: id("payment"), invoice_id: paidAdvance.id, amount: 500, method: "Cash", paid_at: "2026-11-16" });
  const approved = await invoices.create(projectId, { vendorName: "Employer", trade: "Work", direction: "receivable", invoiceType: "progress", status: "Approved", retentionRate: 5, vatRate: 0, whtRate: 0,
    lineItems: [{ description: "Approved concrete", quantity: 3, unit: "m3", unitRate: 1000 }] });
  const draft = await invoices.create(projectId, { vendorName: "Employer", trade: "Work", direction: "receivable", invoiceType: "progress", status: "Draft", retentionRate: 5, vatRate: 0, whtRate: 0,
    lineItems: [{ description: "Proposed concrete", quantity: 2, unit: "m3", unitRate: 400 }] });
  await db("project_invoices").where({ id: approved.id }).update({ advance_recovery: 200 });
  await db("project_invoices").where({ id: draft.id }).update({ advance_recovery: 300 });
  const voided = await invoices.create(projectId, { vendorName: "Employer", trade: "Work", direction: "receivable", invoiceType: "progress", status: "Approved", retentionRate: 5,
    lineItems: [{ description: "Voided work", quantity: 1, unitRate: 999 }] });
  await db("project_invoices").where({ id: voided.id }).update({ voided_at: new Date() });
  const access = await messagingAgentAccess(db).project(id("owner"), projectId), scope = { projectId, organizationId: id("org"), buildingId: null };
  const discovery = await messagingToolDiscovery(db, access, scope);
  const retention = await discovery.runRead("get_retention", {}) as Record<string, unknown>;
  assert.equal(retention.retentionRatePct, 5); assert.equal(retention.retentionHeld, 150);
  const advance = await discovery.runRead("get_advance", {}) as Record<string, unknown>;
  assert.equal(advance.advanceCertificateTotal, 3000); assert.equal(advance.actualReceipts, 500);
  assert.equal(advance.recordedRecovery, 500); assert.equal(advance.approvedRecovery, 200);
  assert.equal(advance.advancePercentagePct, 30); assert.equal(advance.recoveryRatePct, 20);
  assert.ok(JSON.stringify(advance.certificates).includes(draftAdvance.id));
  const measured = await discovery.runRead("get_measured_work", {}) as Record<string, unknown>;
  assert.equal(measured.approvedLineTotal, 3000);
  assert.ok(JSON.stringify(measured.records).includes("Proposed concrete"));
  assert.ok(!JSON.stringify(measured.records).includes("Voided work"));
}));

test("evidence discovery keeps authorized staged files with document tools disabled and excludes original voice translations", { skip: !url }, async () => fixture(async (db, id) => {
  await db("uploaded_files").insert(["photo", "voice"].map((name) => ({ id: id(name), project_id: id("site"), owner_id: id("owner"), file_name: `${name}.bin`, mime_type: "application/octet-stream", size_bytes: 1, storage_path: "fixture" })));
  await messagingAgentRepository(db).acceptMessage({ origin: "web", channel: "telegram", channelAccountId: id("account"), senderId: id("owner"),
    replyRecipientId: id("owner"), conversationType: "direct", providerMessageId: randomUUID(), sentAt: new Date(),
    type: "audio", sourceFileId: id("voice"), text: null, mediaId: null, mediaMimeType: "audio/ogg", replyToMessageId: null });
  await db("platform_settings").where({ id: "singleton" }).update({ feature_flags: JSON.stringify({ "projects.documents": false }) });
  const access = await messagingAgentAccess(db).project(id("owner"), id("site"));
  const discovery = await messagingToolDiscovery(db, access, { projectId: id("site"), organizationId: id("org"), buildingId: null });
  const files = discovery.targets.files as { value: string }[];
  assert.ok(files.some((file) => file.value === id("photo")));
  assert.ok(!files.some((file) => file.value === id("voice")));
  assert.ok(!discovery.tools.some((tool) => tool.kind === "upload_document"));
  assert.equal(discovery.uploads, true);
  await db("project_participants").where({ id: id("participant") }).update({ grants: JSON.stringify({ project: ["view"], materials: ["view"] }) });
  const readOnly = await messagingAgentAccess(db).project(id("crew"), id("site"));
  assert.equal((await messagingToolDiscovery(db, readOnly, { projectId: id("site"), organizationId: id("org"), buildingId: null })).uploads, false);
}));

test("canonical target options include both roster assignees and the imported BoQ rather than substituting proposal items", { skip: !url }, async () => fixture(async (db, id) => {
  await db("team_members").insert({ id: id("roster"), project_id: id("site"), name: "Concrete crew", role: "Mason", status: "Active" });
  await db("boq_import_jobs").insert({ id: id("boq"), project_id: id("site"), status: "completed", file_name: "Site BOQ.csv", storage_path: "fixture",
    materials: JSON.stringify([{ materialName: "Sharp sand", quantity: 30, unit: "tonne", estimatedCost: 150, supplier: "Site supplier" }]), requested_by: id("owner") });
  const access = await messagingAgentAccess(db).project(id("owner"), id("site"));
  const discovery = await messagingToolDiscovery(db, access, { projectId: id("site"), organizationId: id("org"), buildingId: null });
  const options = discovery.targets.options as Record<string, unknown>;
  assert.ok((options.taskAssignees as { value: string; kind: string }[]).some((row) => row.value === id("roster") && row.kind === "team"));
  assert.ok((options.teamMembers as { value: string }[]).some((row) => row.value === id("roster")));
  assert.ok(!(options.assignees as { value: string }[]).some((row) => row.value === id("roster")));
  assert.deepEqual((options.boqMaterials as Record<string, unknown>[])[0], { value: "Sharp sand", label: "Sharp sand", materialName: "Sharp sand", unit: "tonne", estimatedCost: 150, supplier: "Site supplier" });
}));

test("standalone read execution uses PostgreSQL repeatable-read and read-only transaction modes", { skip: !url }, async () => {
  const db = knex({ client: "pg", connection: url }), id = `readonly_${randomUUID()}`;
  try {
    await db("user").insert({ id, name: "Read owner", email: `${id}@test.invalid` });
    await db("projects").insert({ id, owner_id: id, name: "Read fixture", address: "Fixture", status: "On Track", risk: "Low", currency: "NGN" });
    const access = await messagingAgentAccess(db).project(id, id), discovery = await messagingToolDiscovery(db, access, { projectId: id, organizationId: null, buildingId: null });
    const statements: string[] = [], watch = (query: Knex.Sql) => statements.push(query.sql);
    db.on("query", watch);
    try { await discovery.runRead("read_material_approval", {}); }
    finally { db.removeListener("query", watch); }
    assert.ok(statements.some((sql) => /REPEATABLE READ/i.test(sql)));
    assert.ok(statements.some((sql) => /READ ONLY/i.test(sql)));
    assert.ok(!statements.some((sql) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql)));
  } finally {
    await db("projects").where({ id }).delete(); await db("user").where({ id }).delete(); await db.destroy();
  }
});

test("drawing follow-up review schemas contain only currently authorized child actions", { skip: !url }, async () => fixture(async (db, id) => {
  const grants = { project: ["view"], documents: ["view", "markup"] };
  const scope = { projectId: id("site"), organizationId: id("org"), buildingId: null };
  const descriptor = async () => {
    const access = await messagingAgentAccess(db).project(id("crew"), scope.projectId);
    return (await messagingToolDiscovery(db, access, scope)).tools.find((tool) => tool.kind === "annotate_drawing")!;
  };
  await db("project_participants").where({ id: id("participant") }).update({ grants: JSON.stringify(grants) });
  const none = await descriptor();
  assert.ok(!Object.hasOwn((none.schema as { properties: object }).properties, "followUp"));
  assert.ok(none.fields.every((field) => !field.name.startsWith("followUp")));
  await db("project_participants").where({ id: id("participant") }).update({ grants: JSON.stringify({ ...grants, rfis: ["view", "create"] }) });
  const one = await descriptor();
  const schema = one.schema as typeof fieldToolSchemas.annotate_drawing;
  assert.deepEqual(schema.properties.followUp.oneOf.map((branch) => branch.properties.kind.const), ["rfi"]);
  assert.equal(fieldToolSchemas.annotate_drawing.properties.followUp.oneOf.length, 2);
}));
