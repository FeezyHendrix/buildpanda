import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictError, ForbiddenError } from "../../lib/errors.ts";
import { messagingAdapterRegistry } from "./channels.ts";
import { normalizeReview } from "./draft.ts";
import { MessagingClarificationError } from "./draft-errors.ts";
import { messagingAgentReviewService } from "./review-service.ts";
import { messagingAgentService } from "./service.ts";
import { fixture } from "./test-fixture.ts";

const databaseUrl = process.env.MESSAGING_AGENT_TEST_DATABASE_URL;
const grants = { project: ["view"], materials: ["view", "request"] };

test("separate incomplete deliveries remain a conversation until reviewed material receipts are confirmed once", { skip: !databaseUrl }, async () => fixture(async (f) => {
  await f.db("project_participants").where({ user_id: f.userId }).update({ grants: JSON.stringify(grants) });
  const linked = await f.link(); await f.repo.setScope(linked.conversation.id, { ...f.scope, buildingId: null });
  const tanker = "A tanker arrived late; it was expected the previous week.", sand = "Some sand arrived as well.";
  const worker = f.worker({ draft: async (text, scope) => {
    assert.equal(scope.buildingId, null);
    if (text === tanker) throw new MessagingClarificationError("What was in the tanker, and what quantity and unit arrived?");
    assert.ok(scope.recentMessages?.some((message) => message.content === tanker));
    if (text === sand) throw new MessagingClarificationError("What did the tanker carry, how much arrived, and how much sand arrived with its unit?");
    assert.ok(scope.recentMessages?.some((message) => message.content === sand));
    return normalizeReview([
      { kind: "material_log", payload: { entryType: "IN", materialName: "Water", quantity: 5000, unit: "litre", reason: "Tanker arrived late; expected the previous week." } },
      { kind: "material_log", payload: { entryType: "IN", materialName: "Sand", quantity: 10, unit: "tonne" } },
    ], scope);
  } });
  const first = await f.receive(tanker); await worker.processInbox(first.id);
  assert.equal((await f.repo.inbox(first.id))?.status, "processed");
  const question = await f.reply(first.id); assert.match(question.body, /What was in the tanker/);
  assert.deepEqual(question.buttons.map((button: { label: string }) => button.label), ["Cancel"]);
  const firstDraft = await f.repo.pendingProposal(linked.conversation.id); assert.ok(firstDraft?.clarification);
  await assert.rejects(messagingAgentReviewService(f.db).confirm(f.userId, f.scope.projectId, firstDraft.id, firstDraft.version), ConflictError);
  const second = await f.receive(sand); await worker.processInbox(second.id);
  assert.equal((await f.repo.inbox(second.id))?.status, "processed");
  assert.equal((await f.repo.proposal(firstDraft.id))?.status, "cancelled");
  const incomplete = await f.repo.pendingProposal(linked.conversation.id); assert.ok(incomplete?.clarification);
  const details = await f.receive("The tanker held 5000 litres of water; 10 tonnes of sand arrived."); await worker.processInbox(details.id);
  const review = await f.reply(details.id); assert.match(review.body, /Material: Water/); assert.match(review.body, /Material: Sand/);
  assert.match(review.body, /5000 litre/); assert.match(review.body, /10 tonne/); assert.match(review.body, /expected the previous week/);
  assert.equal(review.body.includes("Building:"), false);
  const count = async (table: string) => Number((await f.db(table).where({ project_id: f.scope.projectId }).count("*").first())!.count);
  assert.equal(await count("material_ledger_entries"), 0); assert.equal(await count("daily_log_entries"), 0);
  const confirm = await f.receive(review.buttons[0].command); await worker.processInbox(confirm.id);
  assert.equal((await f.repo.inbox(confirm.id))?.status, "processed");
  assert.equal(await count("material_ledger_entries"), 2); assert.equal(await count("daily_log_entries"), 0);
  const replay = await f.receive(review.buttons[0].command); await worker.processInbox(replay.id);
  assert.equal(await count("material_ledger_entries"), 2);
  const movements = await f.db("material_ledger_entries").where({ project_id: f.scope.projectId }).select("material_name_snapshot", "quantity", "unit_snapshot", "reason", "notes_html");
  assert.deepEqual(movements.map((row) => [row.material_name_snapshot, Number(row.quantity), row.unit_snapshot]), [["Water", 5000, "litre"], ["Sand", 10, "tonne"]]);
  assert.match(movements[0]!.reason, /expected the previous week/); assert.match(movements[0]!.notes_html, /expected the previous week/);
}));

test("material capture is project scoped and does not grant daily-log, building or history permissions", { skip: !databaseUrl }, async () => fixture(async (f) => {
  await f.db("project_participants").where({ user_id: f.userId }).update({ grants: JSON.stringify({ project: ["view"], materials: ["request"] }) });
  const service = messagingAgentService(f.db, messagingAdapterRegistry([f.adapter]));
  assert.ok((await service.status(f.userId)).projects.some((project) => project.id === f.scope.projectId));
  const code = await service.link(f.userId, { channel: f.sender.channel, accountId: f.sender.channelAccountId, projectId: f.scope.projectId, buildingId: null });
  const linked = await f.repo.consumeLinkCode((await import("./service.ts")).linkCodeHash(code.code), f.sender); assert.ok(linked);
  const session = await service.session(f.userId, f.scope.projectId, linked.identity.id);
  assert.equal(session.buildingId, null); assert.deepEqual(session.buildings, []); assert.deepEqual(session.messages, []);
  assert.deepEqual({ ...session.capabilities, actions: undefined }, { actions: undefined, capture: true, read: false, dailyLogCreate: false, materialReceipt: true, materialUsage: false });
  const source = await f.receive("Sand delivery");
  const denied = messagingAgentReviewService(f.db, async (_text, scope) => normalizeReview([{ kind: "material_log", payload: { entryType: "USED", materialName: "Sand", quantity: 1, unit: "tonne" } }], scope));
  await assert.rejects(denied.draft(source, linked.identity, linked.conversation, source.source_text!), ForbiddenError);
}));
