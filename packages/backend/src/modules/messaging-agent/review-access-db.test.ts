import assert from "node:assert/strict";
import { test } from "node:test";
import { messagingAgentAccess } from "./access.ts";
import { messagingAdapterRegistry } from "./channels.ts";
import { normalizeReview } from "./draft.ts";
import { MessagingAnswerResult } from "./draft-errors.ts";
import { mayReadAnswer, messagingReadFingerprint } from "./read-access.ts";
import { canReadMessagingAction } from "./policy.ts";
import { messagingAgentReviewService } from "./review-service.ts";
import { messagingAgentService } from "./service.ts";
import { fixture } from "./test-fixture.ts";

const url = process.env.MESSAGING_AGENT_TEST_DATABASE_URL;

test("task reassignment revokes queued read answers and history even when all grants stay unchanged", { skip: !url }, async () => fixture(async (f) => {
  await f.db("project_participants").where({ user_id: f.userId }).update({ grants: JSON.stringify({ project: ["view"], buildings: ["view"], tasks: ["view"], dailyLog: ["view"] }) });
  await f.db("task_boards").insert({ id: f.id("board"), project_id: f.scope.projectId, building_id: f.scope.buildingId, name: "Tasks" });
  await f.db("task_columns").insert({ id: f.id("column"), board_id: f.id("board"), name: "To do", status: "Todo" });
  await f.db("tasks").insert({ id: f.id("task"), project_id: f.scope.projectId, building_id: f.scope.buildingId, board_id: f.id("board"), column_id: f.id("column"), title: "Private beam review", created_by_id: f.ownerId });
  await f.db("task_assignees").insert({ task_id: f.id("task"), assignee_id: f.userId });
  const linked = await f.link(), access = await messagingAgentAccess(f.db).project(f.userId, f.scope.projectId);
  const fingerprint = await messagingReadFingerprint(f.db, access, f.scope);
  const worker = f.worker({ draft: async (_text, scope) => { await scope.runRead!("get_tasks", {}); throw new MessagingAnswerResult("Accessible task: Private beam review."); } });
  const source = await f.receive("What are my tasks?"); await worker.processInbox(source.id);
  assert.equal((await f.repo.inbox(source.id))?.status, "processed");
  const service = messagingAgentService(f.db, messagingAdapterRegistry([f.adapter]));
  assert.ok((await service.session(f.userId, f.scope.projectId, linked.identity.id)).messages.some((message) => message.text.includes("Private beam review")));
  const snapshot = (await f.repo.inbox(source.id))!.read_access!; assert.equal(snapshot.recordScope, fingerprint);
  await f.db("task_assignees").where({ task_id: f.id("task"), assignee_id: f.userId }).delete();
  const current = await messagingAgentAccess(f.db).project(f.userId, f.scope.projectId);
  assert.deepEqual(current.permissions, access.permissions);
  const changed = await messagingReadFingerprint(f.db, current, f.scope); assert.notEqual(changed, fingerprint);
  assert.equal(mayReadAnswer(current, snapshot, changed), false);
  assert.equal((await service.session(f.userId, f.scope.projectId, linked.identity.id)).messages.some((message) => message.text.includes("Private beam review")), false);
  const reply = await f.reply(source.id); await worker.processOutbox(reply.id);
  assert.equal((await f.repo.outbox(reply.id))?.status, "cancelled"); assert.equal(f.sent.length, 0);
}));

test("completed confirmation replay redacts a task after assignment or its read grant is revoked", { skip: !url }, async () => fixture(async (f) => {
  const grants = { project: ["view"], buildings: ["view"], tasks: ["view"], comments: ["post", "view"], dailyLog: ["view"] };
  await f.db("project_participants").where({ user_id: f.userId }).update({ grants: JSON.stringify(grants) });
  await f.db("task_boards").insert({ id: f.id("board"), project_id: f.scope.projectId, building_id: f.scope.buildingId, name: "Tasks" });
  await f.db("task_columns").insert({ id: f.id("column"), board_id: f.id("board"), name: "To do", status: "Todo" });
  await f.db("tasks").insert({ id: f.id("task"), project_id: f.scope.projectId, building_id: f.scope.buildingId, board_id: f.id("board"), column_id: f.id("column"), title: "Private beam review", created_by_id: f.ownerId });
  await f.db("task_assignees").insert({ task_id: f.id("task"), assignee_id: f.userId });
  const linked = await f.link(); const inbox = await f.receive("Add a private task comment");
  const review = messagingAgentReviewService(f.db, async (_text, scope) => normalizeReview([{ kind: "comment_task", payload: { taskId: f.id("task"), body: "Sensitive task discussion" } }], scope));
  const proposal = await review.draft(inbox, linked.identity, linked.conversation, inbox.source_text!); assert.ok("id" in proposal);
  await review.confirm(f.userId, f.scope.projectId, proposal.id, proposal.version);
  await f.db("task_assignees").where({ task_id: f.id("task"), assignee_id: f.userId }).delete();
  const replay = await review.confirm(f.userId, f.scope.projectId, proposal.id, proposal.version);
  assert.equal(replay.status, "completed"); assert.deepEqual(replay.actions, []); assert.equal(replay.sourceText, ""); assert.equal(JSON.stringify(replay).includes("Sensitive task discussion"), false);
  assert.equal(Number((await f.db("task_comments").where({ task_id: f.id("task") }).count("*").first())!.count), 1);
  const access = await messagingAgentAccess(f.db).project(f.userId, f.scope.projectId);
  assert.equal(canReadMessagingAction({ ...access, permissions: { ...access.permissions, tasks: [] } }, "comment_task"), false);
}));

test("one confirmed field conversation executes mixed materials, task and RFI actions once", { skip: !url }, async () => fixture(async (f) => {
  await f.db("project_participants").where({ user_id: f.userId }).update({ grants: JSON.stringify({ project: ["view"], buildings: ["view"], materials: ["view", "request"], tasks: ["view", "add"], rfis: ["view", "create"] }) });
  await f.link();
  const worker = f.worker({ draft: async (_text, scope) => normalizeReview([
    { kind: "material_log", payload: { entryType: "IN", materialName: "Sand", quantity: 10, unit: "tonne" } },
    { kind: "create_task", payload: { title: "Inspect delivered sand", description: "Check the delivery before use" } },
    { kind: "rfi", payload: { subject: "Sand specification", question: "Confirm the sand grade before use" } },
  ], scope) });
  const source = await f.receive("10 tonnes of sand arrived. Create an inspection task and ask the designer to confirm the grade."); await worker.processInbox(source.id);
  assert.equal((await f.repo.inbox(source.id))?.status, "processed");
  const count = async (table: string) => Number((await f.db(table).where({ project_id: f.scope.projectId }).count("*").first())!.count);
  for (const table of ["material_ledger_entries", "tasks", "rfis"]) assert.equal(await count(table), 0);
  const reply = await f.reply(source.id); const command = reply.buttons.find((button: { label: string }) => button.label === "Confirm").command;
  const confirm = await f.receive(command); await worker.processInbox(confirm.id); assert.equal((await f.repo.inbox(confirm.id))?.status, "processed");
  for (const table of ["material_ledger_entries", "tasks", "rfis"]) assert.equal(await count(table), 1);
  const replay = await f.receive(command); await worker.processInbox(replay.id);
  for (const table of ["material_ledger_entries", "tasks", "rfis"]) assert.equal(await count(table), 1);
  assert.equal(await count("daily_log_entries"), 0);
}));
