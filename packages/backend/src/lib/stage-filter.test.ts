import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import knexFactory, { type Knex } from "knex";
import { up, down } from "../db/migrations/20261009_update_build_stage.ts";
import { updatesRepository } from "../modules/updates/repository.ts";
import { updatesService } from "../modules/updates/service.ts";
import { invoicesRepository } from "../modules/invoices/repository.ts";
import { rfisRepository } from "../modules/rfis/repository.ts";
import { taskStageRepository } from "../modules/tasks/stage-repository.ts";
import { taskStageService } from "../modules/tasks/stage-service.ts";
import type { TaskBoard } from "../modules/tasks/types.ts";
import { updateAgentRepository } from "../modules/panda-ai/agent/update-repository.ts";

// Point this at a disposable migrated database. Every fixture rolls back.
const connection = process.env["STAGE_FILTER_TEST_DATABASE_URL"];
const options = { skip: connection ? false : "requires STAGE_FILTER_TEST_DATABASE_URL" };
let db: Knex;
before(() => { if (connection) db = knexFactory({ client: "pg", connection, pool: { min: 0, max: 2 } }); });
after(async () => { if (db) await db.destroy(); });

async function seed(trx: Knex.Transaction) {
  const prefix = randomUUID();
  const id = (key: string) => `${prefix}_${key}`;
  await trx("user").insert({ id: id("user"), name: "Stage tester", email: `${prefix}@example.test` });
  for (const project of ["project", "other"]) {
    await trx("projects").insert({ id: id(project), name: project, owner_id: id("user"),
      address: "Test site", status: "On Track", risk: "Low", currency: "NGN" });
    await trx("buildings").insert({ id: id(`${project}_building`), project_id: id(project), name: "Block A" });
  }
  for (const [stage, project] of [["foundation", "project"], ["roof", "project"], ["foreign", "other"]] as const) {
    await trx("project_phases").insert({ id: id(stage), project_id: id(project), name: stage,
      building_id: id(`${project}_building`), status: "Pending" });
  }
  await trx("activities").insert({ id: id("activity"), project_id: id("project"), name: "Pour slab",
    activity_type: "Task", phase_id: id("foundation"), building_id: id("project_building"),
    planned_start_at: new Date(), planned_end_at: new Date() });
  const updateService = updatesService(updatesRepository(trx));
  const createUpdate = (title: string, extra = {}) => updateService.create(id("project"),
    { title, description: title, category: "Progress", ...extra }, { id: id("user"), name: "Stage tester" });
  const manual = await createUpdate("Manual", { stageId: id("foundation") });
  const linked = await createUpdate("Activity", { activityId: id("activity") });
  const overridden = await createUpdate("Override", { activityId: id("activity"), stageId: id("roof") });
  const unassigned = await createUpdate("Unassigned");
  const draft = await createUpdate("Draft", { stageId: id("foundation") });
  await trx("project_updates").where({ id: draft.id }).update({ is_draft: true });
  await updateService.create(id("other"), { title: "Other project", description: "Hidden", category: "Progress",
    stageId: id("foreign") }, { id: id("user"), name: "Stage tester" });
  return { id, manual, linked, overridden, unassigned, draft, updateService, createUpdate };
}

async function withFixture(run: (trx: Knex.Transaction, fixture: Awaited<ReturnType<typeof seed>>) => Promise<void>) {
  const trx = await db.transaction();
  try { await run(trx, await seed(trx)); }
  finally { await trx.rollback(); }
}

test("updates combine explicit and activity stages without leaking drafts or other projects", options, async () => {
  await withFixture(async (trx, f) => {
    const repository = updatesRepository(trx);
    const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();
    assert.deepEqual(ids(await repository.listByProject(f.id("project"), { stageId: f.id("foundation") })),
      ids([f.manual, f.linked]));
    assert.deepEqual(ids(await repository.listByProject(f.id("project"), { stageId: f.id("roof") })), [f.overridden.id]);
    assert.deepEqual(ids(await repository.listByProject(f.id("project"))), ids([f.manual, f.linked, f.overridden, f.unassigned]));
    assert.deepEqual(ids(await repository.listByProject(f.id("project"), { stageId: f.id("foundation"), includeDrafts: true })),
      ids([f.manual, f.linked, f.draft]));
    assert.deepEqual(await repository.listByProject(f.id("project"), { stageId: f.id("foreign") }), []);
  });
});

test("updates persist stage edits, clearing and rejection of foreign stages", options, async () => {
  await withFixture(async (_trx, f) => {
    assert.equal(f.manual.stageId, f.id("foundation"));
    assert.equal((await f.updateService.edit(f.id("project"), f.manual.id, { stageId: f.id("roof") })).stageId, f.id("roof"));
    assert.equal((await f.updateService.edit(f.id("project"), f.manual.id, { title: "Still roof" })).stageId, f.id("roof"));
    assert.equal((await f.updateService.edit(f.id("project"), f.manual.id, { stageId: null })).stageId, null);
    await assert.rejects(f.createUpdate("Bad stage", { stageId: f.id("foreign") }), /must belong to this project/);
    await assert.rejects(f.updateService.edit(f.id("project"), f.manual.id, { stageId: f.id("foreign") }), /must belong to this project/);
    await assert.rejects(f.updateService.edit(f.id("other"), f.manual.id, { stageId: f.id("foreign") }), /not found/i);
  });
});

test("invoice and task filters follow stage lines and purchase orders, bounded by visible tasks", options, async () => {
  await withFixture(async (trx, { id }) => {
    await trx("purchase_orders").insert({ id: id("po"), project_id: id("project"), po_number: "PO-1",
      vendor_name: "Test vendor", stage_id: id("foundation") });
    for (const key of ["line", "po", "unassigned", "foreign"]) {
      await trx("project_invoices").insert({ id: id(`invoice_${key}`), project_id: id(key === "foreign" ? "other" : "project"),
        vendor_name: "Test vendor", trade: "General", po_reference_id: key === "po" ? id("po") : null });
    }
    // An invoice spanning stages remains one record in either filtered list.
    await trx("invoice_stage_lines").insert(["foundation", "roof"].map((stage) => ({ id: id(`line_${stage}`), project_id: id("project"),
      invoice_id: id("invoice_line"), stage_id: id(stage) })));
    const invoices = invoicesRepository(trx);
    assert.deepEqual((await invoices.listByProject(id("project"), id("foundation"))).map((r) => r.id).sort(),
      [id("invoice_line"), id("invoice_po")].sort());
    assert.equal((await invoices.listByProject(id("project"))).length, 3);
    assert.deepEqual(await invoices.listByProject(id("project"), id("foreign")), []);
    await trx("task_boards").insert({ id: id("board"), project_id: id("project"), building_id: id("project_building") });
    await trx("task_columns").insert({ id: id("column"), board_id: id("board"), name: "To do" });
    for (const key of ["line", "po", "unassigned"]) {
      await trx("tasks").insert({ id: id(`task_${key}`), project_id: id("project"), board_id: id("board"),
        column_id: id("column"), title: key, building_id: id("project_building") });
      await trx("task_entity_links").insert({ id: id(`link_${key}`), project_id: id("project"), task_id: id(`task_${key}`),
        entity_type: "invoice", entity_id: id(`invoice_${key}`) });
    }
    const repository = taskStageRepository(trx);
    await trx("task_entity_links").insert({ id: id("second_match"), project_id: id("project"), task_id: id("task_line"),
      entity_type: "invoice", entity_id: id("invoice_po") });
    assert.deepEqual((await repository.matchingIds(id("project"), [id("task_line"), id("task_po"), id("task_unassigned")], id("foundation"))).sort(),
      [id("task_line"), id("task_po")].sort());
    const board = { projectId: id("project"), columns: [{ id: id("column") }],
      tasks: [{ id: id("task_po") }, { id: id("task_unassigned") }] } as TaskBoard;
    const service = taskStageService(repository);
    assert.deepEqual((await service.filter(board, id("foundation"))).tasks.map((task) => task.id), [id("task_po")]);
    assert.strictEqual(await service.filter(board), board);
    assert.deepEqual(await repository.matchingIds(id("other"), [id("task_po")], id("foundation")), []);
  });
});

test("RFI stage filtering keeps status, assignee and external visibility restrictions", options, async () => {
  await withFixture(async (trx, { id }) => {
    await trx("change_requests").insert({ id: id("change"), project_id: id("project"), title: "Stage change", stage_id: id("foundation") });
    for (const [number, visibility, status] of [[1, "shared", "Open"], [2, "internal", "Open"], [3, "shared", "Closed"]] as const) {
      await trx("rfis").insert({ id: id(`rfi_${number}`), project_id: id("project"), number, subject: "Test RFI", question: "Details?",
        visibility, status, ball_in_court_id: id("user"), change_request_id: id("change") });
    }
    const repository = rfisRepository(trx);
    assert.equal((await repository.listByProject(id("project"), { stageId: id("foundation") })).length, 3);
    assert.deepEqual((await repository.listByProject(id("project"), { stageId: id("foundation"), sharedOnly: true, status: "Open" }))
      .map((row) => row.id), [id("rfi_1")]);
    assert.deepEqual(await repository.listByProject(id("project"), { stageId: id("foundation"), ballInCourtId: id("nobody") }), []);
    assert.deepEqual(await repository.listByProject(id("other"), { stageId: id("foundation") }), []);
  });
});

test("Panda AI reads published updates with the same effective stage and project scope", options, async () => {
  await withFixture(async (trx, f) => {
    const rows = await updateAgentRepository(trx).publishedUpdates(f.id("project"), f.id("foundation"));
    assert.deepEqual(rows.map((row) => row.id).sort(), [f.manual.id, f.linked.id].sort());
    assert.ok(rows.every((row) => row.stageId === f.id("foundation")));
  });
});

test("stage migration reverses cleanly and deletion clears the update assignment", options, async () => {
  const trx = await db.transaction();
  try {
    await down(trx);
    assert.equal(await trx.schema.hasColumn("project_updates", "stage_id"), false);
    await up(trx);
    const f = await seed(trx);
    await trx("project_updates").where({ id: f.manual.id }).update({ stage_id: f.id("roof") });
    await trx("project_phases").where({ id: f.id("roof") }).delete();
    assert.equal((await trx("project_updates").where({ id: f.manual.id }).first()).stage_id, null);
  } finally { await trx.rollback(); }
});
