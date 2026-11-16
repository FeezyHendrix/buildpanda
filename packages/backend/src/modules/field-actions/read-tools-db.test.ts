import { requireTaskEntityTargetRead } from "../tasks/entity-access.ts";
import { taskEntityAccessRepository } from "../tasks/entity-access-repository.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import knex, { type Knex } from "knex";
import { types as pgTypes } from "pg";
import { buildFieldReadTools, fieldReadToolPermissions } from "./read-tools.ts";
import { workCoordinationHandlers } from "./work-coordination.ts";
import { fieldToolContext } from "./tool-context.ts";
import { messagingService } from "../messaging/service.ts";
import { messagingRepository } from "../messaging/repository.ts";
import type { ToolContext } from "../panda-ai/agent/tool-context.ts";
import type { FieldToolInput } from "./tool-types.ts";

import { buildTasksServices } from "../tasks/wiring.ts";
import { buildTransactionsService } from "../transactions/wiring.ts";
import { PRESET_TRANSACTION_CATEGORIES } from "../transactions/types.ts";
import { buildMaterialApprovalsService } from "../approvals/material-wiring.ts";
import { buildMaterialsServices } from "../materials-equipment/wiring.ts";
import { buildMaterialsLedgerService } from "../materials-ledger/wiring.ts";
import { documentsService } from "../documents/service.ts";
import { documentsRepository } from "../documents/repository.ts";
import { filesRepository } from "../files/repository.ts";
import { drawingMarkupService } from "../drawing-markup/service.ts";
import { drawingMarkupRepository } from "../drawing-markup/repository.ts";

const url = process.env.FIELD_ACTION_TEST_DATABASE_URL ?? process.env.MESSAGING_AGENT_TEST_DATABASE_URL;
pgTypes.setTypeParser(1082, (value: string) => value);

async function fixture(run: (db: Knex.Transaction, id: (key: string) => string) => Promise<void>) {
  const connection = knex({ client: "pg", connection: url });
  const db = await connection.transaction(), prefix = `read_${randomUUID()}`;
  const id = (key: string) => `${prefix}_${key}`;
  try {
    await db("user").insert(["owner", "crew", "outsider"].map((key) => ({ id: id(key), name: key, email: `${id(key)}@test.invalid` })));
    await db("organization").insert({ id: id("org"), name: "Read facade", slug: id("org") });
    await db("member").insert({ id: id("member"), organizationId: id("org"), userId: id("owner"), role: "owner" });
    await db("projects").insert(["site", "other"].map((key) => ({ id: id(key), name: key, address: "Fixture", status: "On Track", risk: "Low", currency: "NGN", organization_id: id("org"), owner_id: id("owner") })));
    await db("buildings").insert(["building", "otherBuilding"].map((key) => ({ id: id(key), project_id: id(key === "building" ? "site" : "other"), name: key })));
    const grants = Object.fromEntries(["project", "rfis", "materials", "dailyLog", "schedule", "stages", "key-dates", "documents", "messages", "tasks"].map((resource) => [resource, ["view"]]));
    grants.finances = ["viewCosts"];
    await db("project_participants").insert({ id: id("participant"), project_id: id("site"), user_id: id("crew"), email: `${id("crew")}@test.invalid`, role: "site_agent", status: "active", grants: JSON.stringify(grants) });
    await db("project_phases").insert({ id: id("stage"), project_id: id("site"), building_id: id("building"), name: "Frame", status: "Pending", date_range: "Nov 2026" });
    await db("activities").insert({ id: id("activity"), project_id: id("site"), building_id: id("building"), phase_id: id("stage"), name: "Pour beam", activity_type: "Concrete", planned_start_at: "2026-11-15", planned_end_at: "2026-11-17" });
    await db("platform_settings").insert({ id: "singleton", feature_flags: JSON.stringify(Object.fromEntries(["projects.schedule", "quality.dailyLogs", "workflow.rfis", "workflow.changeRequests", "commercial.materialsEquipment", "commercial.materialsLedger", "projects.documents", "commercial.transactions", "collaboration.messaging", "compliance.keyDates"].map((key) => [key, true]))) }).onConflict("id").merge();
    await run(db, id);
  } finally { await db.rollback(); await connection.destroy(); }
}

function reader(db: Knex, id: (key: string) => string, who = "owner") {
  const context: ToolContext = { db, projectId: id("site"), caller: { user: { id: id(who), name: who }, project: { id: id("site"), ownerId: id("owner"), organizationId: id("org") }, orgRoles: new Map(), projectRoles: new Map(), orgPermissions: new Map(), projectSectionPermissions: new Map(), projectGrants: new Map() } };
  const tools = buildFieldReadTools();
  return async (name: string, args: Record<string, unknown> = {}) => {
    const tool = tools.find((entry) => entry.spec.function.name === name);
    assert.ok(tool, name);
    return (await tool.run(context, args)).output;
  };
}

async function write(db: Knex, id: (key: string) => string, kind: keyof typeof workCoordinationHandlers, payload: Record<string, unknown>) {
  const input: FieldToolInput = { kind, projectId: id("site"), buildingId: id("building"), payload, idempotencyKey: randomUUID() };
  const context = await fieldToolContext(db, input, { userId: id("owner"), organizationId: id("org") });
  return workCoordinationHandlers[kind](input, context);
}

test("all fifteen canonical read tools run without DML, lazy board/contract creation or provider side effects", { skip: !url }, async () => fixture(async (db, id) => {
  const read = reader(db, id), tools = buildFieldReadTools();
  assert.equal(tools.length, 15);
  assert.deepEqual(tools.map((tool) => tool.spec.function.name).sort(), Object.keys(fieldReadToolPermissions).sort());
  const writes: string[] = [];
  const watch = (query: { sql: string }) => { if (/^\s*(insert|update|delete|merge|truncate|alter|create)\b/i.test(query.sql)) writes.push(query.sql); };
  db.on("query", watch);
  try {
    for (const tool of tools) {
      const name = tool.spec.function.name;
      if (name === "read_drawing") await assert.rejects(read(name), /Choose a drawing/);
      else await read(name, name === "read_task" ? { buildingId: id("building") } : {});
    }
    const day = await read("read_daily_log", { date: "2026-11-15", buildingId: id("building") });
    assert.equal((day as { recorded: boolean }).recorded, false);
    assert.deepEqual(writes, []);
  } finally { db.off("query", watch); }
  assert.equal(Number((await db("task_boards").where({ project_id: id("site") }).count("*").first())!.count), 0);
  assert.equal(Number((await db("project_contracts").where({ project_id: id("site") }).count("*").first())!.count), 0);
}));

test("read facade preserves RFI response/history and enforces external visibility, live grants and own/assigned task access", { skip: !url }, async () => fixture(async (db, id) => {
  const rfi = await write(db, id, "rfi", { subject: "Beam clarification", question: "Confirm cover", ballInCourtId: id("owner") });
  await write(db, id, "respond_rfi", { rfiId: rfi.recordId, body: "Proposal", official: false });
  await write(db, id, "respond_rfi", { rfiId: rfi.recordId, body: "Use 40 mm cover", contentHtml: "<p>Use <strong>40 mm</strong> cover</p>" });
  const mine = await write(db, id, "create_task", { title: "Crew task", buildingId: id("building"), assigneeId: id("crew") });
  const hidden = await write(db, id, "create_task", { title: "Office task", buildingId: id("building") });
  await write(db, id, "comment_task", { taskId: mine.recordId, body: "Inspect before pour" });
  const read = reader(db, id, "crew");
  await assert.rejects(read("read_rfi", { targetId: rfi.recordId }), /RFI/);
  await db("rfis").where({ id: rfi.recordId }).update({ visibility: "shared" });
  const detail = await read("read_rfi", { targetId: rfi.recordId }) as { comments: { isProposedResponse: boolean }[]; events: unknown[]; status: string };
  assert.equal(detail.status, "Answered"); assert.ok(detail.events.length > 0);
  assert.ok(detail.comments.every((comment) => !comment.isProposedResponse));
  const task = await read("read_task", { targetId: mine.recordId }) as { comments: { body: string }[] };
  assert.equal(task.comments[0]!.body, "Inspect before pour");
  await assert.rejects(read("read_task", { targetId: hidden.recordId }), /only access tasks/);
  const board = await read("read_task", { buildingId: id("building") }) as { tasks: { id: string }[] };
  assert.deepEqual(board.tasks.map((entry) => entry.id), [mine.recordId]);
  await assert.rejects(read("read_task", { buildingId: id("otherBuilding") }), /Building|building/);
  await assert.rejects(read("read_task", { targetId: mine.recordId, invented: true }), /additional properties/);
  await db("project_participants").where({ id: id("participant") }).update({ grants: JSON.stringify({ project: ["view"] }) });
  await assert.rejects(read("read_task", { targetId: mine.recordId }), /permission|does not allow/);
  await assert.rejects(reader(db, id, "outsider")("read_rfi"), /permission|access/i);
}));

test("conversation reads require channel membership and project/workspace permission and reject another project's messages", { skip: !url }, async () => fixture(async (db, id) => {
  const service = messagingService(messagingRepository(db));
  const channel = await service.createChannel({ type: "project", name: "Site discussion", projectId: id("site"), organizationId: id("org"), memberIds: [id("crew")] }, id("owner"));
  const foreign = await service.createChannel({ type: "project", name: "Other project", projectId: id("other"), organizationId: id("org"), memberIds: [id("crew")] }, id("owner"));
  const message = await service.sendMessage(channel.id, { body: "Beam inspection complete" }, { id: id("owner"), name: "owner" });
  const secret = await service.sendMessage(foreign.id, { body: "Other project secret" }, { id: id("owner"), name: "owner" });
  const read = reader(db, id, "crew");
  assert.equal((await read("read_conversation", { targetId: channel.id }) as unknown[]).length, 1);
  assert.equal((await read("read_conversation", { messageId: message.id, view: "message" }) as { body: string }).body, "Beam inspection complete");
  await assert.rejects(read("read_conversation", { messageId: secret.id, view: "message" }), /selected project or workspace/);
  await assert.rejects(reader(db, id, "outsider")("read_conversation", { targetId: channel.id }), /permission|access/i);
  await db("project_participants").where({ id: id("participant") }).update({ grants: JSON.stringify({ project: ["view"] }) });
  await assert.rejects(read("read_conversation", { targetId: channel.id }), /permission|does not allow/);
}));


test("task details hide unauthorized linked-domain labels and private RFIs through the shared canonical filter", { skip: !url }, async () => fixture(async (db, id) => {
  const task = await write(db, id, "create_task", { title: "Crew task", buildingId: id("building"), assigneeId: id("crew") });
  const privateRfi = await write(db, id, "rfi", { subject: "Confidential design risk", question: "Internal only", ballInCourtId: id("owner") });
  const sharedRfi = await write(db, id, "rfi", { subject: "Issued detail", question: "Confirm", ballInCourtId: id("owner") });
  await db("rfis").where({ id: sharedRfi.recordId }).update({ visibility: "shared" });
  const change = await write(db, id, "change_request", { title: "Confidential variation price", description: "Price", costImpact: 100 });
  const tasks = buildTasksServices(db).service;
  for (const [type, target] of [["rfi", privateRfi.recordId], ["rfi", sharedRfi.recordId], ["change_request", change.recordId]] as const) {
    await tasks.addEntityLink(id("site"), task.recordId, type, target, id("owner"));
  }
  const owner = await reader(db, id)("read_task", { targetId: task.recordId }) as { entityLinks: unknown[] };
  assert.equal(owner.entityLinks.length, 3);
  const crew = await reader(db, id, "crew")("read_task", { targetId: task.recordId }) as { entityLinks: { entityId: string }[]; entityLinkTypes: string[] };
  assert.deepEqual(crew.entityLinks.map((link) => link.entityId), [sharedRfi.recordId]);
  assert.deepEqual(crew.entityLinkTypes, ["rfi"]);
  const context = await fieldToolContext(db, { kind: "read_task", projectId: id("site"), buildingId: null, payload: {}, idempotencyKey: "check" }, { userId: id("crew"), organizationId: id("org") });
  await assert.rejects(requireTaskEntityTargetRead(context.request, context.project, "rfi", privateRfi.recordId, taskEntityAccessRepository(db)), /Linked record/);
  await assert.rejects(requireTaskEntityTargetRead(context.request, context.project, "change_request", change.recordId, taskEntityAccessRepository(db)), /does not allow/);
  await requireTaskEntityTargetRead(context.request, context.project, "rfi", sharedRfi.recordId, taskEntityAccessRepository(db));
}));

test("expense detail, lists and analytics consistently restrict the caller to authored expenses", { skip: !url }, async () => fixture(async (db, id) => {
  const input: FieldToolInput = { kind: "read_expense", projectId: id("site"), buildingId: null, payload: {}, idempotencyKey: "fixture" };
  const context = await fieldToolContext(db, input, { userId: id("owner"), organizationId: id("org") });
  const expenses = buildTransactionsService(db, context.request, context.project);
  const category = PRESET_TRANSACTION_CATEGORIES[0]!.key;
  const mine = await expenses.create(id("site"), id("org"), id("crew"), { title: "Crew fuel", category, amount: 300, transactedAt: "2026-11-16" });
  const hidden = await expenses.create(id("site"), id("org"), id("owner"), { title: "Office account", category, amount: 900, transactedAt: "2026-11-16" });
  const read = reader(db, id, "crew");
  const rows = await read("read_expense") as { id: string }[];
  assert.deepEqual(rows.map((row) => row.id), [mine.id]);
  assert.equal((await read("read_expense", { targetId: mine.id }) as { amount: number }).amount, 300);
  await assert.rejects(read("read_expense", { targetId: hidden.id }), /Expense|Transaction/i);
  const analytics = await read("read_expense", { view: "analytics" }) as { count: number; totalAmount: number };
  assert.equal(analytics.count, 1); assert.equal(analytics.totalAmount, 300);
  await db("project_participants").where({ id: id("participant") }).update({ grants: JSON.stringify({ project: ["view"], finances: ["viewCosts", "viewAllExpenses"] }) });
  assert.equal((await read("read_expense") as unknown[]).length, 2);
}));

test("material reads retain approval comments, delivery history and ledger source details", { skip: !url }, async () => fixture(async (db, id) => {
  const approvals = buildMaterialApprovalsService(db);
  const approval = await approvals.create(id("site"), { title: "Sand source", materialName: "Sand", quantity: 10, unit: "m3", specification: "Sharp sand" }, id("owner"));
  await approvals.addComment(id("site"), approval.id, "Sample inspected", { id: id("owner"), name: "Owner" });
  const { service: orders, deliveries } = buildMaterialsServices({ db });
  const order = await orders.createMaterialOrder(id("site"), { title: "Sand order", materialName: "Sand", quantity: 10, unit: "m3", neededBy: "2026-11-16", status: "Approved" }, id("owner"));
  await deliveries.record(id("site"), order.id, { deliveredQty: 4, deliveredAt: "2026-11-16", deliveryNote: "DN-4" }, id("owner"));
  const ledger = buildMaterialsLedgerService(db);
  const received = await ledger.logEntry(id("site"), { entryType: "IN", materialName: "Gravel", quantity: 3, unit: "m3", reason: "Expected last week", notesHtml: "<p>Expected last week</p>", deliveryNote: "DN-3" }, id("owner"));
  const read = reader(db, id, "crew");
  const detail = await read("read_material_approval", { targetId: approval.id }) as { comments: { body: string }[] };
  assert.equal(detail.comments[0]!.body, "Sample inspected");
  const procured = await read("read_material_order", { targetId: order.id }) as { deliveries: { deliveryNote: string }[] };
  assert.equal(procured.deliveries[0]!.deliveryNote, "DN-4");
  const entry = await read("read_material_log", { targetId: received.entry.id }) as { reason: string; notesHtml: string; deliveryNote: string };
  assert.equal(entry.reason, "Expected last week"); assert.equal(entry.notesHtml, "<p>Expected last week</p>"); assert.equal(entry.deliveryNote, "DN-3");
}));

test("document and drawing details preserve exact revisions, geometry and comments and reject foreign targets", { skip: !url }, async () => fixture(async (db, id) => {
  await db("uploaded_files").insert(["drawing", "revision"].map((key) => ({ id: id(key), owner_id: id("owner"), project_id: id("site"), file_name: `${key}.pdf`, mime_type: "application/pdf", size_bytes: 100, storage_path: `test/${id(key)}` })));
  const documents = documentsService(documentsRepository(db), filesRepository(db));
  const document = await documents.create(id("site"), { fileId: id("drawing"), title: "Beam plan", revision: "A" }, id("owner"));
  assert.ok(document.currentVersionId);
  const markups = drawingMarkupService(drawingMarkupRepository(db));
  const markup = await markups.create(id("site"), id("owner"), { documentId: document.id, documentVersionId: document.currentVersionId, pageNo: 2, kind: "pin", geometry: { kind: "pin", at: { x: 30, y: 40 } } });
  await markups.addComment(markup.id, id("owner"), { body: "Verify cover" });
  const next = await documents.addVersion(id("site"), document.id, { fileId: id("revision"), revisionLabel: "B", notes: "Revised beam" }, id("owner"));
  const read = reader(db, id, "crew");
  const detail = await read("read_document", { targetId: document.id }) as { versions: { id: string }[] };
  assert.equal(detail.versions.length, 2);
  const original = await read("read_drawing", { targetId: markup.id }) as { documentVersionId: string; pageNo: number; comments: { body: string }[] };
  assert.equal(original.documentVersionId, document.currentVersionId); assert.equal(original.pageNo, 2); assert.equal(original.comments[0]!.body, "Verify cover");
  await assert.rejects(read("read_drawing", { targetId: markup.id, documentVersionId: next.id }), /selected drawing revision/);
  assert.deepEqual(await read("read_drawing", { documentVersionId: next.id }), []);
  const foreign = await documents.create(id("other"), { fileName: "Foreign.pdf", size: "1 KB" }, id("owner"));
  await assert.rejects(read("read_document", { targetId: foreign.id }), /Document/);
}));


test("conversation membership and effective workspace permission remain independent from project Messages grants", { skip: !url }, async () => fixture(async (db, id) => {
  const service = messagingService(messagingRepository(db));
  const privateChannel = await service.createChannel({ type: "project", name: "Managers", projectId: id("site"), organizationId: id("org"), memberIds: [] }, id("owner"));
  const workspace = await service.createChannel({ type: "org", name: "Workspace", organizationId: id("org"), memberIds: [id("crew")] }, id("owner"));
  const crew = reader(db, id, "crew");
  await assert.rejects(crew("read_conversation", { targetId: privateChannel.id }), /Channel/);
  await assert.rejects(crew("read_conversation", { targetId: workspace.id }), /workspace|role|permission/i);
  assert.deepEqual(await reader(db, id)("read_conversation", { targetId: workspace.id }), []);
  const listed = await crew("read_conversation") as { id: string }[];
  assert.ok(!listed.some((channel) => channel.id === workspace.id));
  await db("platform_settings").where({ id: "singleton" }).update({ feature_flags: JSON.stringify({ "workflow.rfis": false }) });
  await assert.rejects(reader(db, id)("read_rfi"), /disabled/i);
}));
