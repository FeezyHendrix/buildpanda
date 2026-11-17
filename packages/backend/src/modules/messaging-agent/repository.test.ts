import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import knex from "knex";
import { messagingAgentRepository } from "./repository.ts";
import { messagingAgentReadRepository } from "./read-repository.ts";
import type { MessagingInboundMessage, MessagingScope } from "./types.ts";

const databaseUrl = process.env.MESSAGING_AGENT_TEST_DATABASE_URL;

async function fixture(run: (f: Awaited<ReturnType<typeof createFixture>>) => Promise<void>) {
  const f = await createFixture();
  try { await run(f); } finally {
    await f.db("messaging_agent_inbox").where({ channel_account_id: f.sender.channelAccountId }).delete();
    await f.db("projects").whereIn("id", [f.scope.projectId, f.otherScope.projectId]).delete();
    await f.db("organization").where({ id: f.scope.organizationId }).delete();
    await f.db("user").whereIn("id", [f.userId, f.otherUserId]).delete();
    await f.db.destroy();
  }
}

async function createFixture() {
  const db = knex({ client: "pg", connection: databaseUrl, pool: { min: 0, max: 8 } });
  const suffix = randomUUID();
  const userId = `wa-test-${suffix}`, otherUserId = `wa-other-${suffix}`, orgId = `wa-org-${suffix}`;
  const scope: MessagingScope = { organizationId: orgId, projectId: `wa-project-${suffix}`, buildingId: `wa-building-${suffix}` };
  const otherScope: MessagingScope = { organizationId: orgId, projectId: `wa-other-project-${suffix}`, buildingId: `wa-other-building-${suffix}` };
  await db("user").insert([userId, otherUserId].map((id) => ({ id, name: "Crew", email: `${id}@messagingAgent.invalid` })));
  await db("organization").insert({ id: orgId, name: "Messaging fixture", slug: orgId });
  await db("projects").insert([scope, otherScope].map((s) => ({ id: s.projectId, organization_id: orgId, owner_id: userId, name: "Site", address: "Fixture", status: "On Track", risk: "Low", currency: "NGN" })));
  await db("buildings").insert([scope, otherScope].map((s) => ({ id: s.buildingId, project_id: s.projectId, name: "Block" })));
  const store = messagingAgentRepository(db);
  const sender = { channel: "whatsapp", channelAccountId: `wa-number-${suffix}`, senderId: `US.${suffix}` };
  const message = (id: string = randomUUID()): MessagingInboundMessage => ({ ...sender, replyRecipientId: sender.senderId, conversationType: "direct", providerMessageId: id, sentAt: new Date(), type: "text", text: "Ten workers", mediaId: null, mediaMimeType: null, replyToMessageId: null });
  async function code(owner = userId, account = sender) {
    const codeHash = createHash("sha256").update(randomUUID()).digest("hex");
    await store.createLinkCode({ ...scope, channel: account.channel, channelAccountId: account.channelAccountId, userId: owner, codeHash, expiresAt: new Date(Date.now() + 60_000) });
    return codeHash;
  }
  async function linked() {
    const result = await store.consumeLinkCode(await code(), sender);
    assert.ok(result);
    return result;
  }
  return { db, store, userId, otherUserId, scope, otherScope, sender, message, code, linked };
}

test("a link code is single use under concurrent claims and cannot transfer an active sender", { skip: !databaseUrl }, async () => fixture(async (f) => {
  const code = await f.code();
  const results = await Promise.all([f.store.consumeLinkCode(code, f.sender), f.store.consumeLinkCode(code, f.sender)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal((await f.store.identitiesForUser(f.userId)).length, 1);
  const otherCode = await f.code(f.otherUserId);
  assert.equal(await f.store.consumeLinkCode(otherCode, f.sender), null);
  const original = results.find(Boolean)!;
  await f.store.revokeIdentity(original.identity.id, f.userId);
  const relinked = await f.store.consumeLinkCode(otherCode, f.sender);
  assert.ok(relinked);
  assert.notEqual(relinked.identity.id, original.identity.id);
  assert.notEqual(relinked.conversation.id, original.conversation.id);
  assert.equal(relinked.identity.user_id, f.otherUserId);
  assert.deepEqual(await f.store.proposalsForUser(f.otherUserId), []);
}));

test("inbound provider replay persists once and concurrent workers claim only once", { skip: !databaseUrl }, async () => fixture(async (f) => {
  await f.linked();
  const message = f.message();
  const accepted = await Promise.all(Array.from({ length: 5 }, () => f.store.acceptMessage(message)));
  assert.equal(accepted.filter(Boolean).length, 1);
  const inbox = accepted.find(Boolean)!;
  const claimed = await Promise.all(Array.from({ length: 5 }, () => f.store.claimInbox(inbox.id)));
  assert.equal(claimed.filter(Boolean).length, 1);
  await f.store.completeInbox(inbox.id);
  assert.equal(await f.store.claimInbox(inbox.id), null);
  assert.equal((await f.store.inbox(inbox.id))!.status, "processed");
}));

test("scope snapshots survive switching and a delayed message cannot be refiled", { skip: !databaseUrl }, async () => fixture(async (f) => {
  const { conversation } = await f.linked();
  const inbox = await f.store.acceptMessage(f.message());
  assert.ok(inbox);
  const switched = await f.store.setScope(conversation.id, f.otherScope);
  assert.equal((await f.store.inbox(inbox.id))!.project_id, f.scope.projectId);
  await assert.rejects(f.store.createProposal({ conversationId: conversation.id, inboxId: inbox.id,
    scopeVersion: switched.scope_version, sourceText: "Ten workers", sourceKind: "text", actions: [{ kind: "daily_log", payload: {} }],
  }), /different project scope/);
}));

test("editing increments proposal version, retains history and invalidates previous confirmation", { skip: !databaseUrl }, async () => fixture(async (f) => {
  const { conversation } = await f.linked();
  const inbox = await f.store.acceptMessage(f.message());
  assert.ok(inbox);
  const proposal = await f.store.createProposal({ conversationId: conversation.id, inboxId: inbox.id,
    scopeVersion: conversation.scope_version, sourceText: "Ten workers", sourceKind: "text", actions: [{ kind: "update_daily_log", payload: { workersPresent: 10 } }],
  });
  const updated = await f.store.updateProposal(proposal.id, 1, [{ kind: "update_daily_log", payload: { workersPresent: 12 } }]);
  assert.equal(updated.version, 2);
  assert.equal(updated.project_id, f.scope.projectId);
  assert.equal((await f.store.actionsForProposal(proposal.id, 1))[0]!.payload.workersPresent, 10);
  assert.equal((await f.store.actionsForProposal(proposal.id, 2))[0]!.payload.workersPresent, 12);
  assert.equal(await f.store.finishProposal(proposal.id, 1, "confirmed"), false);
  assert.equal(await f.store.finishProposal(proposal.id, 2, "confirmed"), true);
  await assert.rejects(f.store.updateProposal(proposal.id, 2, [{ kind: "daily_log", payload: {} }]), /already confirmed/);
}));

test("action lock and committed receipt persist one business effect across concurrent workers", { skip: !databaseUrl }, async () => fixture(async (f) => {
  const { conversation } = await f.linked();
  const inbox = await f.store.acceptMessage(f.message());
  assert.ok(inbox);
  const proposal = await f.store.createProposal({ conversationId: conversation.id, inboxId: inbox.id,
    scopeVersion: conversation.scope_version, sourceText: "Note", sourceKind: "text", actions: [{ kind: "daily_log", payload: {} }],
  });
  const [action] = await f.store.actionsForProposal(proposal.id, 1);
  assert.ok(action);
  const run = () => f.db.transaction(async (trx) => {
    const store = messagingAgentRepository(trx);
    const locked = await store.lockAction(action.id);
    assert.ok(locked);
    if (locked.status === "committed") return locked.result;
    await trx("projects").where({ id: f.scope.projectId }).increment("health_score", 1);
    await store.completeAction(action.id, { saved: true });
    return { saved: true };
  });
  const before = await f.db("projects").where({ id: f.scope.projectId }).first("health_score");
  await Promise.all(Array.from({ length: 5 }, run));
  const after = await f.db("projects").where({ id: f.scope.projectId }).first("health_score");
  assert.equal(after.health_score, before.health_score + 1);
  assert.equal((await f.store.action(action.id))!.status, "committed");
}));

test("outbox dedupes, claims once and quarantines uncertain sends without downgrading delivery", { skip: !databaseUrl }, async () => fixture(async (f) => {
  const { identity, conversation } = await f.linked();
  const inbox = await f.store.acceptMessage(f.message());
  assert.ok(inbox);
  const input = { inboxId: inbox.id, identityId: identity.id, conversationId: conversation.id,
    recipientId: f.sender.senderId, body: "Saved", scopeVersion: conversation.scope_version, idempotencyKey: randomUUID() };
  const [first, duplicate] = await Promise.all([f.store.enqueueOutbox(input), f.store.enqueueOutbox(input)]);
  assert.equal(first.id, duplicate.id);
  const claims = await Promise.all(Array.from({ length: 4 }, () => f.store.claimOutbox(first.id)));
  assert.equal(claims.filter(Boolean).length, 1);
  await f.store.finishOutbox(first.id, "unknown", undefined, "Timeout after acceptance");
  assert.ok(!(await f.store.pendingOutbox()).some((row) => row.id === first.id));
  assert.equal(await f.store.claimOutbox(first.id), null);
  const second = await f.store.enqueueOutbox({ ...input, idempotencyKey: randomUUID() });
  await f.store.claimOutbox(second.id);
  await f.store.finishOutbox(second.id, "accepted", `wamid-${randomUUID()}`);
  const providerMessageId = (await f.store.outbox(second.id))!.provider_message_id!;
  await f.store.markDelivery({ ...f.sender, providerMessageId, recipientId: f.sender.senderId, status: "read", sentAt: new Date() });
  await f.store.markDelivery({ ...f.sender, providerMessageId, recipientId: f.sender.senderId, status: "sent", sentAt: new Date() });
  assert.equal((await f.store.outbox(second.id))!.status, "read");
}));

test("channel/account identity, codes, inbox replay and delivery IDs stay isolated even when external IDs are identical", { skip: !databaseUrl }, async () => fixture(async (f) => {
  const telegram = { ...f.sender, channel: "telegram" };
  const otherAccount = { ...f.sender, channelAccountId: `${f.sender.channelAccountId}-other` };
  const boundCode = await f.code();
  assert.equal(await f.store.consumeLinkCode(boundCode, telegram), null);
  assert.equal(await f.store.consumeLinkCode(boundCode, otherAccount), null);
  assert.equal(await f.store.readLinkCode(boundCode, telegram), null);
  const first = await f.store.consumeLinkCode(boundCode, f.sender); assert.ok(first);
  const second = await f.store.consumeLinkCode(await f.code(f.userId, telegram), telegram); assert.ok(second);
  const third = await f.store.consumeLinkCode(await f.code(f.userId, otherAccount), otherAccount); assert.ok(third);
  assert.equal(new Set([first.identity.id, second.identity.id, third.identity.id]).size, 3);
  assert.equal((await f.store.identityForSender(telegram))!.id, second.identity.id);
  assert.equal((await f.store.identityForSender(otherAccount))!.id, third.identity.id);
  const rows = [];
  for (const [sender, connection] of [[f.sender, first], [telegram, second], [otherAccount, third]] as const) {
    const source = { ...f.message("same-message-id"), ...sender, replyRecipientId: sender.senderId };
    const inbox = await f.store.acceptMessage(source); assert.ok(inbox);
    assert.equal(await f.store.acceptMessage(source), null);
    assert.equal(inbox.identity_id, connection.identity.id);
    const outbox = await f.store.enqueueOutbox({ inboxId: inbox.id, identityId: connection.identity.id, conversationId: connection.conversation.id,
      recipientId: sender.senderId, body: "Review", scopeVersion: connection.conversation.scope_version, idempotencyKey: inbox.id });
    await f.store.claimOutbox(outbox.id); await f.store.finishOutbox(outbox.id, "accepted", "same-reply-id");
    rows.push(outbox);
  }
  await f.store.markDelivery({ ...telegram, providerMessageId: "same-reply-id", recipientId: telegram.senderId, status: "read", sentAt: new Date() });
  assert.equal((await f.store.outbox(rows[0]!.id))!.status, "accepted");
  assert.equal((await f.store.outbox(rows[1]!.id))!.status, "read");
  assert.equal((await f.store.outbox(rows[2]!.id))!.status, "accepted");
}));

test("opaque provider IDs and explicit app origins do not collide, and reply addresses remain separate from sender identities", { skip: !databaseUrl }, async () => fixture(async (f) => {
  await f.linked();
  const incoming = { ...f.message("web:123"), replyRecipientId: "private-chat-id" };
  const provider = await f.store.acceptMessage(incoming); assert.ok(provider);
  const web = await f.store.acceptMessage({ ...incoming, origin: "web" }); assert.ok(web);
  assert.equal(provider.origin, "provider"); assert.equal(web.origin, "web");
  const pending = await f.store.pendingInbox(200);
  assert.ok(pending.some((row) => row.id === provider.id)); assert.ok(!pending.some((row) => row.id === web.id));
  await assert.rejects(f.store.enqueueOutbox({ inboxId: provider.id, identityId: provider.identity_id, recipientId: f.sender.senderId,
    body: "Private review", idempotencyKey: provider.id }), /reply destination/);
  const reply = await f.store.enqueueOutbox({ inboxId: provider.id, identityId: provider.identity_id, recipientId: "private-chat-id",
    body: "Private review", idempotencyKey: provider.id });
  assert.equal(reply.recipient_id, "private-chat-id"); assert.equal(reply.channel, f.sender.channel);
}));

test("connection selection isolates one user's proposal history across messaging channels", { skip: !databaseUrl }, async () => fixture(async (f) => {
  const first = await f.linked();
  const telegram = { ...f.sender, channel: "telegram" };
  const second = await f.store.consumeLinkCode(await f.code(f.userId, telegram), telegram); assert.ok(second);
  const reads = messagingAgentReadRepository(f.db);
  const proposals = [];
  for (const [sender, connection] of [[f.sender, first], [telegram, second]] as const) {
    const inbox = await f.store.acceptMessage({ ...f.message("history-message"), ...sender }); assert.ok(inbox);
    proposals.push(await f.store.createProposal({ conversationId: connection.conversation.id, inboxId: inbox.id,
      scopeVersion: connection.conversation.scope_version, sourceText: "Own channel source", sourceKind: "text", actions: [{ kind: "daily_log", payload: {} }] }));
  }
  const own = await reads.proposals(f.userId, f.scope.projectId, f.scope.buildingId, true, first.identity.id);
  assert.deepEqual(own.map((row) => row.id), [proposals[0]!.id]);
  const otherChannel = await reads.proposals(f.userId, f.scope.projectId, f.scope.buildingId, true, second.identity.id);
  assert.deepEqual(otherChannel.map((row) => row.id), [proposals[1]!.id]);
  assert.equal((await reads.connections(f.userId)).length, 2);
  assert.equal(await reads.connection(f.otherUserId, first.identity.id), undefined);
}));
