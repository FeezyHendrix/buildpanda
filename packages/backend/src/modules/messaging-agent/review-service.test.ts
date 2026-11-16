import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import knex, { type Knex } from "knex";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { draftDailyActions, normalizeReview } from "./draft.ts";
import { messagingAgentRepository } from "./repository.ts";
import { messagingAgentReviewService } from "./review-service.ts";
import { linkCodeHash } from "./service.ts";
import { proposalReceipt } from "./mappers.ts";
import type { MessagingConversationRow, MessagingIdentityRow, MessagingScope } from "./types.ts";

const url = process.env.MESSAGING_AGENT_TEST_DATABASE_URL;
const logDate = "2026-11-14";
const grants = { project: ["view"], dailyLog: ["view", "create"], buildings: ["view"] };
const draftNote: typeof draftDailyActions = async (text, scope) => normalizeReview([
  { kind: "daily_log", title: "Site note", payload: { logDate, buildingId: scope.buildingId, bodyText: text } },
], scope);

async function seed(db: Knex) {
  const prefix = `wa_review_${randomUUID()}`;
  const id = (name: string) => `${prefix}_${name}`;
  const repo = messagingAgentRepository(db);
  await db("user").insert(["owner", "alice", "bob"].map((name) => ({ id: id(name), name, email: `${id(name)}@test.invalid` })));
  await db("organization").insert(["a", "b"].map((name) => ({ id: id(`org_${name}`), name, slug: id(`org_${name}`) })));
  await db("projects").insert(["a", "b"].map((name) => ({ id: id(`project_${name}`), organization_id: id(`org_${name}`), owner_id: id("owner"), name, address: "Fixture", status: "On Track", risk: "Low", currency: "NGN" })));
  await db("buildings").insert(["a", "b"].map((name) => ({ id: id(`building_${name}`), project_id: id(`project_${name}`), name })));
  await db("project_participants").insert([["alice", "a"], ["alice", "b"], ["bob", "b"]].map(([user, site]) => ({
    id: id(`${user}_${site}`), project_id: id(`project_${site}`), user_id: id(user!), email: `${id(user!)}@test.invalid`, role: "site_agent", status: "active", grants: JSON.stringify(grants),
  })));
  const scope = (site: string): MessagingScope => ({ organizationId: id(`org_${site}`), projectId: id(`project_${site}`), buildingId: id(`building_${site}`) });
  const sender = (name: string) => ({ channel: "test-chat", channelAccountId: id("phone"), senderId: id(`sender_${name}`) });
  async function link(userId: string, selected: MessagingScope, name: string = randomUUID()) {
    const code = randomUUID();
    await repo.createLinkCode({ channel: "test-chat", channelAccountId: id("phone"), userId, ...selected, codeHash: linkCodeHash(code), expiresAt: new Date(Date.now() + 60_000) });
    const linked = await repo.consumeLinkCode(linkCodeHash(code), sender(name));
    assert.ok(linked);
    return { ...linked, sender: sender(name), code };
  }
  async function capture(
    linked: { identity: MessagingIdentityRow; conversation: MessagingConversationRow }, text: string,
    draft: typeof draftDailyActions = draftNote,
  ) {
    const message = { channel: "test-chat", conversationType: "direct" as const, replyRecipientId: linked.identity.sender_id, channelAccountId: linked.identity.channel_account_id, senderId: linked.identity.sender_id,
      providerMessageId: id(randomUUID()), type: "text" as const, text, sentAt: new Date(), mediaId: null, mediaMimeType: null, replyToMessageId: null };
    const inbox = await repo.acceptMessage(message);
    assert.ok(inbox); assert.ok(await repo.claimInbox(inbox.id));
    const review = messagingAgentReviewService(db, draft);
    const proposal = await review.draft(inbox, linked.identity, linked.conversation, text);
    await repo.completeInbox(inbox.id);
    return { message, inbox, proposal, review };
  }
  async function count(table: string) {
    return Number((await db(table).whereIn("project_id", [scope("a").projectId, scope("b").projectId]).count("*").first())!.count);
  }
  return { id, scope, sender, repo, link, capture, count, async cleanup() {
    await db("projects").whereIn("id", [scope("a").projectId, scope("b").projectId]).del();
    await db("organization").whereIn("id", [scope("a").organizationId, scope("b").organizationId]).del();
    await db("user").whereIn("id", [id("owner"), id("alice"), id("bob")]).del();
  } };
}

function dbTest(name: string, run: (db: Knex, fixture: Awaited<ReturnType<typeof seed>>) => Promise<void>) {
  test(name, { skip: !url }, async () => {
    const db = knex({ client: "pg", connection: url, pool: { min: 0, max: 6 } });
    let fixture: Awaited<ReturnType<typeof seed>> | undefined;
    try { fixture = await seed(db); await run(db, fixture); }
    finally { try { await fixture?.cleanup(); } finally { await db.destroy(); } }
  });
}

dbTest("link codes bind one sender to one user and the exact company/project/building", async (db, f) => {
  const a = await f.link(f.id("alice"), f.scope("a"), "alice");
  assert.equal(a.identity.user_id, f.id("alice"));
  assert.equal(a.conversation.identity_id, a.identity.id);
  assert.equal(a.conversation.organization_id, f.scope("a").organizationId);
  assert.equal(a.conversation.project_id, f.scope("a").projectId);
  assert.equal(a.conversation.building_id, f.scope("a").buildingId);
  assert.equal(await f.repo.consumeLinkCode(linkCodeHash(a.code), f.sender("replay")), null);
  const code = randomUUID();
  const row = await f.repo.createLinkCode({ channel: "test-chat", channelAccountId: f.id("phone"), userId: f.id("bob"), ...f.scope("b"), codeHash: linkCodeHash(code), expiresAt: new Date(Date.now() + 60_000) });
  assert.equal(await f.repo.consumeLinkCode(linkCodeHash(code), a.sender), null);
  assert.equal((await db("messaging_agent_link_codes").where({ id: row.id }).first()).consumed_at, null);
  const b = await f.repo.consumeLinkCode(linkCodeHash(code), f.sender("bob"));
  assert.ok(b); assert.equal(b.identity.user_id, f.id("bob"));
  assert.equal(b.conversation.organization_id, f.scope("b").organizationId);
  const expired = randomUUID();
  await f.repo.createLinkCode({ channel: "test-chat", channelAccountId: f.id("phone"), userId: f.id("alice"), ...f.scope("a"), codeHash: linkCodeHash(expired), expiresAt: new Date(Date.now() - 1_000) });
  assert.equal(await f.repo.consumeLinkCode(linkCodeHash(expired), f.sender("expired")), null);
});

dbTest("text drafting and corrections retain raw sources and versions without domain writes or replay duplicates", async (db, f) => {
  const linked = await f.link(f.id("alice"), f.scope("a"));
  const text = "  Eight workers.\n\nSlab poured — 12m³.  ";
  const first = await f.capture(linked, text);
  assert.equal(first.proposal.status, "draft"); assert.equal(first.proposal.version, 1);
  assert.equal(first.proposal.sourceText, text);
  assert.equal(await f.count("daily_log_entries"), 0); assert.equal(await f.count("daily_logs"), 0);
  assert.equal(await f.repo.acceptMessage(first.message), null);
  const replay = await first.review.draft(first.inbox, linked.identity, linked.conversation, "replayed altered text");
  assert.equal(replay.id, first.proposal.id); assert.equal(replay.sourceText, text);
  assert.equal(await f.count("messaging_agent_proposals"), 1);
  const edited = await first.review.edit(f.id("alice"), f.scope("a").projectId, first.proposal.id, 1, [
    { kind: "daily_log", payload: { logDate, buildingId: f.scope("a").buildingId, bodyText: "Actually nine workers.\nSlab poured." } },
  ]);
  assert.equal(edited.version, 2);
  assert.equal(edited.actions[0]!.payload.bodyText, "Actually nine workers.\nSlab poured.");
  assert.match(edited.summary, /Actually nine workers/); assert.doesNotMatch(edited.summary, /Eight workers/);
  assert.equal(edited.sourceText, text);
  assert.equal((await f.repo.actionsForProposal(edited.id, 1))[0]!.payload.bodyText, text);
  await assert.rejects(first.review.edit(f.id("alice"), f.scope("a").projectId, edited.id, 1, edited.actions), ConflictError);
  await assert.rejects(first.review.confirm(f.id("alice"), f.scope("a").projectId, edited.id, 1), ConflictError);
  let previousText: unknown;
  const correction = await f.capture(linked, "Correction: ten workers", async (source, scope, previous) => {
    previousText = previous?.[0]?.payload.bodyText;
    return draftNote(source, scope);
  });
  assert.equal(previousText, edited.actions[0]!.payload.bodyText);
  assert.equal((await f.repo.proposal(edited.id))!.status, "cancelled");
  assert.equal(correction.proposal.sourceText, "Correction: ten workers");
  assert.equal((await f.repo.inbox(first.inbox.id))!.source_text, text);
  assert.equal((await f.repo.proposal(first.proposal.id))!.source_text, text);
  assert.equal(await f.count("daily_log_entries"), 0);
  assert.equal(Number((await db("messaging_agent_actions").where({ proposal_id: edited.id }).count("*").first())!.count), 2);
});

dbTest("concurrent confirms commit each action and receipt once; replay returns the saved result", async (db, f) => {
  const linked = await f.link(f.id("alice"), f.scope("a"));
  const request = await f.capture(linked, "Pour finished", async (text, scope) => normalizeReview([
    { kind: "daily_log", payload: { logDate, buildingId: scope.buildingId, bodyText: text } },
    { kind: "update_daily_log", payload: { logDate, buildingId: scope.buildingId, workersPresent: 8, workersExpected: 10, windKph: 0, totalHours: 7.5 } },
  ], scope));
  const confirm = () => request.review.confirm(f.id("alice"), f.scope("a").projectId, request.proposal.id, 1);
  const results = await Promise.all(Array.from({ length: 6 }, confirm));
  assert.ok(results.every((result) => result.status === "completed" && result.result?.recordId === results[0]!.result?.recordId));
  assert.equal(await f.count("daily_log_entries"), 1); assert.equal(await f.count("daily_logs"), 1);
  const actions = await f.repo.actionsForProposal(request.proposal.id, 1);
  assert.ok(actions.every((action) => action.status === "committed" && action.result?.recordId));
  assert.equal(actions[0]!.result!.recordId, results[0]!.result!.recordId);
  assert.ok(await db("daily_log_entries").where({ id: actions[0]!.result!.recordId }).first());
  const header = await db("daily_logs").where({ project_id: f.scope("a").projectId }).first();
  assert.equal(header.workers_present, 8); assert.equal(header.wind_kph, "0.00");
  assert.deepEqual(await confirm(), results[0]);
  assert.equal((await f.repo.proposal(request.proposal.id))!.source_text, "Pour finished");
});

dbTest("a later invalid action rolls back earlier domain writes and all action receipts", async (_db, f) => {
  const linked = await f.link(f.id("alice"), f.scope("a"));
  const request = await f.capture(linked, "First note, then missing form", async (_text, scope) => normalizeReview([
    { kind: "daily_log", payload: { logDate, buildingId: scope.buildingId, bodyText: "Must roll back" } },
    { kind: "daily_log", payload: { logDate, buildingId: scope.buildingId, templateId: f.id("missing_template"), responses: {} } },
  ], scope));
  const pending = await f.repo.proposal(request.proposal.id); assert.ok(pending);
  const pendingActions = await f.repo.actionsForProposal(pending.id, pending.version);
  assert.throws(() => proposalReceipt(pending, pendingActions), BadRequestError);
  await assert.rejects(request.review.confirm(f.id("alice"), f.scope("a").projectId, request.proposal.id, 1), /template/i);
  assert.equal(await f.count("daily_log_entries"), 0); assert.equal(await f.count("daily_logs"), 0);
  const proposal = await f.repo.proposal(request.proposal.id);
  assert.equal(proposal!.status, "draft"); assert.equal(proposal!.confirmed_at, null);
  assert.ok((await f.repo.actionsForProposal(request.proposal.id, 1)).every((action) => action.status === "proposed" && action.result === null));
});

dbTest("confirmation rechecks deny-all grants, identity revocation, and scope changes", async (db, f) => {
  const linked = await f.link(f.id("alice"), f.scope("a"));
  const denied = await f.capture(linked, "Do not save after denial");
  await db("project_participants").where({ id: f.id("alice_a") }).update({ grants: JSON.stringify({}) });
  await assert.rejects(denied.review.confirm(f.id("alice"), f.scope("a").projectId, denied.proposal.id, 1), ForbiddenError);
  assert.equal(await f.count("daily_log_entries"), 0);
  await db("project_participants").where({ id: f.id("alice_a") }).update({ grants: JSON.stringify({ project: ["view"], dailyLog: ["view", "create"] }) });
  await assert.rejects(denied.review.edit(f.id("alice"), f.scope("a").projectId, denied.proposal.id, 1, denied.proposal.actions), ForbiddenError);
  await assert.rejects(denied.review.confirm(f.id("alice"), f.scope("a").projectId, denied.proposal.id, 1), ForbiddenError);
  await assert.rejects(f.capture(linked, "Building access was revoked", async () => { assert.fail("Do not call the model after building access is revoked"); }), ForbiddenError);
  await db("project_participants").where({ id: f.id("alice_a") }).update({ grants: JSON.stringify(grants) });
  await f.repo.setScope(linked.conversation.id, f.scope("b"));
  await assert.rejects(denied.review.confirm(f.id("alice"), f.scope("a").projectId, denied.proposal.id, 1), ConflictError);
  assert.equal((await f.repo.proposal(denied.proposal.id))!.status, "cancelled");
  const conversation = await f.repo.conversation(linked.identity.id); assert.ok(conversation);
  const revoked = await f.capture({ ...linked, conversation }, "Do not save after revocation");
  assert.equal(await f.repo.revokeIdentity(linked.identity.id, f.id("alice")), true);
  await assert.rejects(revoked.review.confirm(f.id("alice"), f.scope("b").projectId, revoked.proposal.id, 1), NotFoundError);
  assert.equal(await f.count("daily_log_entries"), 0);
  assert.ok((await f.repo.actionsForProposal(revoked.proposal.id, 1)).every((action) => action.result === null));
});

dbTest("guessing another company's or sender's proposal cannot read, edit, or confirm it", async (_db, f) => {
  const alice = await f.link(f.id("alice"), f.scope("a"));
  const bob = await f.link(f.id("bob"), f.scope("b"));
  const own = await f.capture(alice, "Company A work");
  const foreign = await f.capture(bob, "Company B private source");
  // Alice can access project B, so identity ownership must still block Bob's review.
  await assert.rejects(own.review.confirm(f.id("alice"), f.scope("b").projectId, foreign.proposal.id, 1), NotFoundError);
  await assert.rejects(own.review.edit(f.id("alice"), f.scope("b").projectId, foreign.proposal.id, 1, foreign.proposal.actions), NotFoundError);
  await assert.rejects(own.review.confirm(f.id("alice"), f.scope("b").projectId, own.proposal.id, 1), NotFoundError);
  assert.equal(await f.count("daily_log_entries"), 0);
  assert.equal((await f.repo.proposal(foreign.proposal.id))!.status, "draft");
});

dbTest("draft source snapshots cannot be mixed with another identity, conversation, or scope", async (_db, f) => {
  const alice = await f.link(f.id("alice"), f.scope("a"));
  const bob = await f.link(f.id("bob"), f.scope("b"));
  const captured = await f.capture(alice, "Bound to company A");
  await assert.rejects(captured.review.draft(captured.inbox, bob.identity, alice.conversation, "Wrong identity"), ForbiddenError);
  await assert.rejects(captured.review.draft(captured.inbox, alice.identity, bob.conversation, "Wrong conversation"), ForbiddenError);
  for (const changed of [
    { project_id: f.scope("b").projectId }, { building_id: f.scope("b").buildingId },
    { scope_version: alice.conversation.scope_version + 1 }, { sender_id: bob.identity.sender_id },
    { channel_account_id: "other-number" },
  ]) await assert.rejects(captured.review.draft({ ...captured.inbox, ...changed }, alice.identity, alice.conversation, "Wrong source"), ForbiddenError);
  assert.equal(await f.count("messaging_agent_proposals"), 1);
  assert.equal(await f.count("daily_log_entries"), 0);
  assert.equal((await f.repo.proposal(captured.proposal.id))!.source_text, "Bound to company A");
});
