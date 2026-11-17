import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import knex, { type Knex } from "knex";
import { types as pgTypes } from "pg";
import { workCoordinationHandlers } from "./work-coordination.ts";
import { fieldToolContext } from "./tool-context.ts";
import type { FieldToolInput } from "./tool-types.ts";

const url = process.env.FIELD_ACTION_TEST_DATABASE_URL ?? process.env.MESSAGING_AGENT_TEST_DATABASE_URL;
pgTypes.setTypeParser(1082, (value: string) => value);

async function fixture(run: (db: Knex.Transaction, id: (key: string) => string) => Promise<void>) {
  const connection = knex({ client: "pg", connection: url });
  const db = await connection.transaction(), prefix = `coord_${randomUUID()}`;
  const id = (key: string) => `${prefix}_${key}`;
  try {
    await db("user").insert(["owner", "crew", "stranger"].map((key) => ({ id: id(key), name: key, email: `${id(key)}@test.invalid` })));
    await db("organization").insert({ id: id("org"), name: "Coordination fixture", slug: id("org") });
    await db("member").insert({ id: id("member"), organizationId: id("org"), userId: id("owner"), role: "owner" });
    await db("projects").insert(["site", "other"].map((key) => ({ id: id(key), name: key, address: "Fixture", status: "On Track", risk: "Low", currency: "NGN", organization_id: id("org"), owner_id: id("owner") })));
    await db("buildings").insert(["a", "b", "foreign"].map((key) => ({ id: id(key), project_id: id(key === "foreign" ? "other" : "site"), name: key })));
    await db("project_participants").insert({ id: id("participant"), project_id: id("site"), user_id: id("crew"), email: `${id("crew")}@test.invalid`, role: "site_agent", status: "active", grants: JSON.stringify({ project: ["view"], tasks: ["view", "add", "remove"], rfis: ["view", "respond"], comments: ["post"], dailyLog: ["create"] }) });
    await db("project_phases").insert({ id: id("stage"), project_id: id("site"), building_id: id("a"), name: "Frame", status: "Pending", date_range: "Nov 2026" });
    await db("activities").insert({ id: id("activity"), project_id: id("site"), building_id: id("a"), phase_id: id("stage"), name: "Pour beam", activity_type: "Concrete", planned_start_at: "2026-11-15", planned_end_at: "2026-11-17" });
    await db("platform_settings").insert({ id: "singleton", feature_flags: JSON.stringify({ "projects.schedule": true, "quality.dailyLogs": true, "workflow.rfis": true, "workflow.changeRequests": true }) }).onConflict("id").merge();
    await run(db, id);
  } finally { await db.rollback(); await connection.destroy(); }
}

function runner(db: Knex, id: (key: string) => string) {
  return async (kind: keyof typeof workCoordinationHandlers, payload: Record<string, unknown>, who = "owner", building = "a") => {
    const input: FieldToolInput = { kind, projectId: id("site"), buildingId: id(building), payload, idempotencyKey: randomUUID() };
    const actor = { userId: id(who), organizationId: id("org") };
    return workCoordinationHandlers[kind](input, await fieldToolContext(db, input, actor));
  };
}

test("all nineteen confirmed work actions use canonical records and retain rich text and state", { skip: !url }, async () => fixture(async (db, id) => {
  const execute = runner(db, id), used = new Set<string>();
  const run: typeof execute = async (kind, payload, who, building) => { used.add(kind); return execute(kind, payload, who, building); };
  const task = await run("create_task", { title: "Inspect beam", buildingId: id("a"), assignees: [{ kind: "user", id: id("owner") }, { kind: "user", id: id("crew") }] });
  await run("update_task", { taskId: task.recordId, description: "Two checks\nRebar and cover", dueDate: "2026-11-17" });
  const doing = await db("task_columns").where({ status: "Doing" }).whereIn("board_id", db("task_boards").where({ project_id: id("site") }).select("id")).first();
  await run("move_task", { taskId: task.recordId, columnId: doing.id });
  await run("comment_task", { taskId: task.recordId, body: "Cover checked" });
  assert.equal((await db("tasks").where({ id: task.recordId }).first()).column_id, doing.id);
  assert.equal(Number((await db("task_assignees").where({ task_id: task.recordId }).count("*").first())!.count), 2);
  await run("delete_task", { taskId: task.recordId });
  assert.equal(await db("tasks").where({ id: task.recordId }).first(), undefined);

  const rfi = await run("rfi", { subject: "Beam reinforcement", question: "Confirm bars", ballInCourtId: id("owner") });
  await run("update_rfi", { rfiId: rfi.recordId, patch: { question: "Confirm bars and cover", questionHtml: "<p>Confirm <strong>bars</strong> and cover</p>" } });
  const comment = await run("comment_rfi", { rfiId: rfi.recordId, body: "Site evidence", contentHtml: "<p>Site <strong>evidence</strong></p><script>bad()</script>" });
  assert.equal((await db("rfi_comments").where({ id: comment.recordId }).first()).content_html, "<p>Site <strong>evidence</strong></p>");
  await run("respond_rfi", { rfiId: rfi.recordId, body: "Use detail A", contentHtml: "<p>Use detail A</p>" });
  assert.equal((await db("rfis").where({ id: rfi.recordId }).first()).status, "Answered");
  await run("transition_rfi", { rfiId: rfi.recordId, status: "Closed" });
  await assert.rejects(execute("respond_rfi", { rfiId: rfi.recordId, body: "Late answer" }), /closed/);

  const change = await run("change_request", { title: "Revised beam", description: "Extra reinforcement", costImpact: 100, stageId: id("stage") });
  await run("update_change_request", { changeRequestId: change.recordId, patch: { costImpact: 120 } });
  await run("comment_change_request", { changeRequestId: change.recordId, body: "Price checked" });
  assert.equal(Number((await db("change_requests").where({ id: change.recordId }).first()).cost_impact), 120);
  await run("delete_change_request", { changeRequestId: change.recordId });

  const lookAhead = await run("look_ahead", { name: "Beam week", buildingId: id("a"), startDate: "2026-11-15", endDate: "2026-11-21", activityIds: [id("activity")] });
  await run("update_look_ahead", { lookAheadId: lookAhead.recordId, patch: { totalWorkers: 8 } });
  assert.equal((await db("look_aheads").where({ id: lookAhead.recordId }).first()).total_workers, 8);
  await assert.rejects(execute("update_look_ahead", { lookAheadId: lookAhead.recordId, patch: { status: "Approved" } }), /Approve action/);
  await run("delete_look_ahead", { lookAheadId: lookAhead.recordId });

  await run("log_activity", { activityId: id("activity"), hoursLogged: 7.5, logDate: "2026-11-15" });
  const link = await db("daily_log_activities").where({ project_id: id("site"), activity_id: id("activity") }).first();
  assert.equal(Number(link.hours_logged), 7.5); assert.equal(link.building_id, id("a"));
  assert.equal((await db("activities").where({ id: id("activity") }).first()).status, "InProgress");
  await run("transition_stage", { stageId: id("stage"), status: "InProgress", buildingId: id("a") });
  assert.equal((await db("project_phases").where({ id: id("stage") }).first()).status, "InProgress");
  assert.equal(used.size, 19);
  await run("transition_stage", { stageId: id("stage"), status: "Done" });
  assert.equal((await db("project_phases").where({ id: id("stage") }).first()).status, "Done");
  assert.equal(used.size, 19);
}));

test("work actions enforce current grants, task visibility, external RFI scope and conditional delay permission", { skip: !url }, async () => fixture(async (db, id) => {
  const run = runner(db, id);
  const mine = await run("create_task", { title: "Assigned to crew", buildingId: id("a"), assigneeId: id("crew") });
  const hidden = await run("create_task", { title: "Office task", buildingId: id("a") });
  await run("update_task", { taskId: mine.recordId, title: "Crew updated" }, "crew");
  await assert.rejects(run("update_task", { taskId: hidden.recordId, title: "Forbidden" }, "crew"), /only access tasks/);
  await assert.rejects(run("create_task", { title: "Foreign building", buildingId: id("foreign") }), /building/);
  const rfi = await run("rfi", { subject: "Private RFI", question: "Internal", ballInCourtId: id("owner") });
  await assert.rejects(run("comment_rfi", { rfiId: rfi.recordId, body: "Cannot see this" }, "crew"), /RFI/);
  await db("rfis").where({ id: rfi.recordId }).update({ visibility: "shared" });
  await assert.rejects(run("respond_rfi", { rfiId: rfi.recordId, body: "Unauthorized official answer" }, "crew"), /Only an RFI manager/);
  await run("respond_rfi", { rfiId: rfi.recordId, body: "Proposed answer", official: false }, "crew");
  assert.equal((await db("rfis").where({ id: rfi.recordId }).first()).status, "Open");
  await assert.rejects(run("log_activity", { activityId: id("activity"), hoursLogged: 2, delayReasonCode: "WEATHER", delayNote: "Rain" }, "crew"), /role does not allow/);
  assert.equal(await db("daily_logs").where({ project_id: id("site") }).first(), undefined);
  await db("project_participants").where({ id: id("participant") }).update({ grants: JSON.stringify({ project: ["view"] }) });
  await assert.rejects(run("update_task", { taskId: mine.recordId, title: "Revoked" }, "crew"), /role does not allow/);
  assert.equal((await db("tasks").where({ id: mine.recordId }).first()).title, "Crew updated");
}));

test("work records and notification rows roll back with their completion receipt", { skip: !url }, async () => fixture(async (db, id) => {
  let taskId = "";
  await assert.rejects(db.transaction(async (transaction) => {
    const task = await runner(transaction, id)("create_task", { title: "Rollback task", buildingId: id("a"), assigneeId: id("crew") });
    taskId = task.recordId;
    assert.ok(await transaction("notifications").where({ project_id: id("site"), type: "task_assigned" }).first());
    throw new Error("Completion receipt failed");
  }), /Completion receipt failed/);
  assert.equal(await db("tasks").where({ id: taskId }).first(), undefined);
  assert.equal(await db("notifications").where({ project_id: id("site") }).first(), undefined);
}));
