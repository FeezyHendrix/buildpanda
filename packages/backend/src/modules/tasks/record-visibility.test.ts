import assert from "node:assert/strict";
import { test } from "node:test";
import { ownGrants, recordFixture, recordTestUrl } from "./record-visibility-fixture.ts";
import { PARTICIPANT_PERMISSIONS } from "../../lib/role-presets.ts";
import { buildTools } from "../panda-ai/agent/tools.ts";
import { toolsForCaller, canRead } from "../panda-ai/agent/tool-permissions.ts";
import { voiceContextRepository } from "../panda-ai/voice-report/context-repository.ts";
import { agentRepository } from "../panda-ai/agent/repository.ts";
import { agentRecordScope } from "../panda-ai/agent/record-scope.ts";

test("HTTP tasks and expenses use explicit full-visibility grants, including overrides and empty results", { skip: !recordTestUrl }, async () => {
  const f = await recordFixture();
  const taskPath = "/projects/scope-site/tasks";
  const expensePath = "/projects/scope-site/transactions";
  async function get(path: string) {
    const response = await f.app.inject(path); assert.equal(response.statusCode, 200, response.body); return response.json();
  }
  try {
    for (const requested of ["all", "assigned", "mine"]) {
      const board = await get(`${taskPath}/board?scope=${requested}&buildingId=scope-building-site`);
      assert.deepEqual(new Set(board.tasks.map((row: { id: string }) => row.id)), new Set(["scope-task-created", "scope-task-assigned", "scope-task-roster"]));
      assert.equal(board.scope, "mine");
      assert.ok(board.tasks.every((row: { mine?: boolean }) => row.mine === true), "scoped boards mark every task mine");
    }
    assert.equal((await get(`${taskPath}/scope-task-roster`)).title, "roster", "a roster assignment matched by verified email is the caller's task");
    assert.equal((await f.app.inject(`${taskPath}/scope-task-roster-other`)).statusCode, 403, "someone else's roster assignment stays hidden");
    assert.equal(f.access().capabilities.canSeeFullTaskBoard, false, "remove does not grant full visibility");
    assert.equal(f.access().capabilities.canSeeAllExpenses, false, "manage does not grant full visibility");
    assert.equal((await get(`${taskPath}/scope-task-created`)).title, "created");
    assert.equal((await f.app.inject(`${taskPath}/scope-task-hidden`)).statusCode, 403);
    assert.equal((await f.app.inject(`${taskPath}/scope-task-foreign`)).statusCode, 404);
    for (const child of ["comments", "subtasks"]) {
      const response = await f.app.inject({ method: "POST", url: `${taskPath}/scope-task-hidden/${child}`, payload: child === "comments" ? { body: "Should never be posted" } : { title: "Should never be created" } });
      assert.equal(response.statusCode, 403, response.body);
    }
    const createdComment = await f.app.inject({ method: "POST", url: `${taskPath}/scope-task-created/comments`, payload: { body: "Creator can comment" } });
    assert.equal(createdComment.statusCode, 201, createdComment.body);
    assert.equal((await f.app.inject({ method: "POST", url: `${taskPath}/scope-task-created/links`, payload: { targetTaskId: "scope-task-hidden" } })).statusCode, 403);
    assert.equal((await f.app.inject({ method: "PATCH", url: `${taskPath}/scope-task-hidden`, payload: { title: "Forbidden" } })).statusCode, 403);
    assert.equal((await f.app.inject({ method: "DELETE", url: `${taskPath}/scope-task-hidden` })).statusCode, 403);
    const expenseRows = await get(expensePath);
    assert.deepEqual(expenseRows.map((row: { id: string }) => row.id), ["scope-expense-created"]);
    assert.equal((await get(`${expensePath}/analytics`)).totalAmount, 100);
    assert.equal((await f.app.inject(`${expensePath}/scope-expense-hidden`)).statusCode, 404);
    assert.equal((await f.app.inject({ method: "PUT", url: `${expensePath}/scope-expense-hidden`, payload: { title: "Forbidden" } })).statusCode, 404);
    assert.equal((await f.app.inject({ method: "DELETE", url: `${expensePath}/scope-expense-hidden` })).statusCode, 404);
    const csv = await f.app.inject(`${expensePath}/export.csv`);
    assert.equal(csv.statusCode, 200, csv.body); assert.match(csv.body, /created expense/); assert.doesNotMatch(csv.body, /hidden expense|foreign expense/);
    assert.equal((await f.app.inject("/projects/scope-site/reporting/snapshot")).statusCode, 403);
    for (const suffix of ["", "?search=hidden", "?category=materials"]) {
      f.asParticipant(ownGrants, "quantity_surveyor", "scope-empty");
      assert.deepEqual(await get(expensePath + suffix), []);
    }
    assert.equal((await get(`${expensePath}/analytics`)).totalAmount, 0);
    f.asParticipant(ownGrants, "project_manager");
    assert.equal((await get(`${taskPath}/board`)).tasks.length, 3, "a role label does not override saved grants");
    f.asParticipant({}, "project_manager");
    assert.equal((await f.app.inject(`${taskPath}/board`)).statusCode, 403);
    assert.equal((await f.app.inject(expensePath)).statusCode, 403);
    for (const role of ["owner", "admin"]) {
      f.asOrganization(role);
      assert.equal((await get(`${taskPath}/board`)).tasks.length, 5, role);
      assert.equal((await get(expensePath)).length, 2, role);
    }
    f.asParticipant(PARTICIPANT_PERMISSIONS.project_manager!, "project_manager");
    assert.equal((await get(`${taskPath}/board`)).tasks.length, 5);
    assert.equal((await get(expensePath)).length, 2);
    f.asParticipant({ ...ownGrants, tasks: ["view", "viewAll"], finances: ["viewCosts", "viewAllExpenses"] }, "guest");
    assert.equal((await get(`${taskPath}/board`)).tasks.length, 5);
    assert.equal((await get(expensePath)).length, 2);
    assert.equal((await f.app.inject("/projects/scope-foreign/tasks/board")).statusCode, 403);
    f.asParticipant({}, "guest", "scope-owner");
    assert.equal((await get(`${taskPath}/board`)).tasks.length, 5, "personal project owner");
    assert.equal((await get(expensePath)).length, 2);
    f.asParticipant();
    assert.equal((await get(expensePath)).length, 1, "revoking view-all immediately narrows reads");
    const posted = await f.app.inject({ method: "POST", url: expensePath, payload: { title: "New own expense", category: "materials", amount: 50, transactedAt: "2026-10-15" } });
    assert.equal(posted.statusCode, 201, posted.body); assert.equal(posted.json().createdById, "scope-crew");
  } finally { await f.close(); }
});

test("files, voice targets and Panda AI reads share task and expense row visibility", { skip: !recordTestUrl }, async () => {
  const f = await recordFixture();
  try {
    for (const id of ["scope-task-file-created", "scope-task-file-assigned", "scope-expense-file-created"]) await f.readFile(id);
    for (const id of ["scope-task-file-hidden", "scope-expense-file-hidden", "scope-expense-file-receipt"]) await assert.rejects(f.readFile(id), /permission|access|read|allowed/i);
    const context = f.toolContext();
    const voice = await voiceContextRepository(f.db).options(f.project.id, { userId: context.caller.user.id, organizationId: "scope-org", can: (resource, action) => canRead(context, resource, action), workspaceCan: () => false, capabilities: f.access().capabilities });
    assert.deepEqual(new Set(voice.tasks!.map((row) => row.value)), new Set(["scope-task-created", "scope-task-assigned", "scope-task-roster"]));
    const tools = toolsForCaller(buildTools(), context);
    const call = async (name: string) => {
      const entry = tools.find((t) => t.spec.function.name === name); assert(entry, name); return (await entry.run(context, {})).output;
    };
    assert.deepEqual(await call("get_task_links"), [], "links to unauthorized resources are absent");
    const tasks = await call("get_tasks");
    assert.match(JSON.stringify(tasks), /created/); assert.match(JSON.stringify(tasks), /assigned/); assert.doesNotMatch(JSON.stringify(tasks), /hidden|foreign/);
    for (const name of ["list_transactions", "get_transaction_summary"]) {
      const expenses = await call(name);
      assert.match(JSON.stringify(expenses), /created expense/); assert.doesNotMatch(JSON.stringify(expenses), /hidden expense|foreign expense/);
      assert.match(JSON.stringify(expenses), /Only expenses logged by the caller/);
    }
    const repository = agentRepository(f.db, agentRecordScope(context));
    assert.equal(await repository.transactionTotal(f.project.id), 100);
    assert.deepEqual(await agentRepository(f.db).tasks(f.project.id), [], "missing caller context is denied");
    assert.equal(await agentRepository(f.db).transactionTotal(f.project.id), 0);
    f.asParticipant({ ...ownGrants, tasks: ["view", "viewAll"], finances: ["viewCosts", "viewAllExpenses"] });
    for (const id of ["scope-task-file-hidden", "scope-expense-file-hidden", "scope-expense-file-receipt"]) await f.readFile(id);
    const full = agentRepository(f.db, agentRecordScope(f.toolContext()));
    assert.equal((await full.tasks(f.project.id)).length, 5);
    assert.equal(await full.transactionTotal(f.project.id), 300);
    f.asParticipant({});
    for (const id of ["scope-task-file-created", "scope-expense-file-created"]) await assert.rejects(f.readFile(id));
  } finally { await f.close(); }
});
