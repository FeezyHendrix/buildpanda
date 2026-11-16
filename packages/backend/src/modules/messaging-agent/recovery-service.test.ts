import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import knex from "knex";
import { ConflictError, ForbiddenError, NotFoundError, ServiceUnavailableError, UnauthorizedError } from "../../lib/errors.ts";
import { messagingAgentRecoveryService } from "./recovery-service.ts";
import { messagingAgentRepository } from "./repository.ts";
import { linkCodeHash } from "./service.ts";
import { messagingAdapterRegistry } from "./channels.ts";

const url = process.env.MESSAGING_AGENT_TEST_DATABASE_URL;
const grants = { project: ["view"], dailyLog: ["create"], buildings: ["view"] };

async function fixture(run: (f: Awaited<ReturnType<typeof seed>>) => Promise<void>) {
  const f = await seed();
  try { await run(f); } finally {
    await f.db("messaging_agent_inbox").where({ channel_account_id: f.sender.channelAccountId }).delete();
    await f.db("projects").where({ id: f.scope.projectId }).delete();
    await f.db("organization").where({ id: f.scope.organizationId }).delete();
    await f.db("user").whereIn("id", [f.userId, f.ownerId, f.otherId]).delete(); await f.db.destroy();
  }
}

async function seed() {
  const db = knex({ client: "pg", connection: url, pool: { min: 0, max: 6 } });
  const prefix = `agent_recovery_${randomUUID()}`, id = (name: string) => `${prefix}_${name}`;
  const userId = id("crew"), ownerId = id("owner"), otherId = id("other");
  const scope = { organizationId: id("org"), projectId: id("project"), buildingId: id("building") };
  const sender = { channel: "fixture-chat", channelAccountId: id("account"), senderId: id("sender") };
  await db("user").insert([userId, ownerId, otherId].map((user) => ({ id: user, name: "Crew", email: `${user}@test.invalid` })));
  await db("organization").insert({ id: scope.organizationId, name: "Company", slug: scope.organizationId });
  await db("projects").insert({ id: scope.projectId, organization_id: scope.organizationId, owner_id: ownerId, name: "Site", address: "Fixture", status: "On Track", risk: "Low", currency: "NGN" });
  await db("buildings").insert([scope.buildingId, id("other_building")].map((building, index) => ({ id: building, project_id: scope.projectId, name: `Block ${index}` })));
  await db("project_participants").insert([userId, otherId].map((user) => ({ id: id(user), project_id: scope.projectId, user_id: user, email: `${user}@test.invalid`, role: "site_agent", status: "active", grants: JSON.stringify(grants) })));
  const repo = messagingAgentRepository(db), code = randomUUID();
  await repo.createLinkCode({ ...scope, channel: sender.channel, channelAccountId: sender.channelAccountId, userId, codeHash: linkCodeHash(code), expiresAt: new Date(Date.now() + 60_000) });
  const linked = await repo.consumeLinkCode(linkCodeHash(code), sender); assert.ok(linked);
  const inbox = await repo.acceptMessage({ ...sender, replyRecipientId: sender.senderId, conversationType: "direct", providerMessageId: randomUUID(), type: "audio", text: null,
    sentAt: new Date(), mediaId: "retained-media", mediaMimeType: "audio/ogg", replyToMessageId: null }); assert.ok(inbox);
  await repo.claimInbox(inbox.id); await repo.failInbox(inbox.id, "Private internal error");
  const adapters = messagingAdapterRegistry([{
    channel: sender.channel, channelAccountId: sender.channelAccountId, label: "Fixture chat", maxTextLength: 4096,
    connectUrl: () => null, canReply: () => true,
    async sendText() { assert.fail("Recovery must not send external messages"); },
    async downloadAudio() { assert.fail("Recovery must not download media"); },
  }]);
  const service = messagingAgentRecoveryService(db, adapters);
  return { db, id, repo, service, userId, ownerId, otherId, scope, sender, inbox, ...linked };
}

function dbTest(name: string, run: Parameters<typeof fixture>[0]) { test(name, { skip: !url }, () => fixture(run)); }

dbTest("a failed retained message can be retried and received/processing retries are idempotent", async (f) => {
  const before = await f.repo.inbox(f.inbox.id);
  assert.deepEqual(await f.service.retry(f.userId, f.scope.projectId, f.inbox.id), { messageId: f.inbox.id, status: "received" });
  assert.equal((await f.service.retry(f.userId, f.scope.projectId, f.inbox.id)).status, "received");
  assert.ok(await f.repo.claimInbox(f.inbox.id));
  assert.equal((await f.service.retry(f.userId, f.scope.projectId, f.inbox.id)).status, "processing");
  const after = await f.repo.inbox(f.inbox.id);
  assert.equal(after?.media_id, before?.media_id); assert.equal(after?.sent_at.toString(), before?.sent_at.toString());
  assert.equal(new Date((await f.repo.identityForSender(f.sender))!.last_inbound_at!).getTime(), new Date(f.identity.last_inbound_at!).getTime());
});

dbTest("another authorized project member cannot retry another sender's message", async (f) => {
  await assert.rejects(f.service.retry(f.otherId, f.scope.projectId, f.inbox.id), NotFoundError);
  assert.equal((await f.repo.inbox(f.inbox.id))?.status, "failed");
});

dbTest("current grants and the exact immutable building/scope are required for retry", async (f) => {
  await f.repo.setScope(f.conversation.id, { ...f.scope, buildingId: f.id("other_building") });
  await assert.rejects(f.service.retry(f.userId, f.scope.projectId, f.inbox.id), ForbiddenError);
  assert.equal((await f.repo.inbox(f.inbox.id))?.status, "failed");
  await f.db("messaging_agent_conversations").where({ id: f.conversation.id }).update({ building_id: f.scope.buildingId, scope_version: f.inbox.scope_version });
  await f.db("project_participants").where({ user_id: f.userId }).delete();
  await assert.rejects(f.service.retry(f.userId, f.scope.projectId, f.inbox.id), ForbiddenError);
});

dbTest("opt-out, unlink, unavailable channel and unavailable actor block retries", async (f) => {
  await f.repo.setOptOut(f.identity.id, true);
  await assert.rejects(f.service.retry(f.userId, f.scope.projectId, f.inbox.id), ForbiddenError);
  await f.repo.setOptOut(f.identity.id, false);
  const unavailable = messagingAgentRecoveryService(f.db, messagingAdapterRegistry([]));
  await assert.rejects(unavailable.retry(f.userId, f.scope.projectId, f.inbox.id), ServiceUnavailableError);
  await f.db("user").where({ id: f.userId }).update({ banned: true });
  await assert.rejects(f.service.retry(f.userId, f.scope.projectId, f.inbox.id), UnauthorizedError);
  await f.db("user").where({ id: f.userId }).update({ banned: false });
  await f.repo.revokeIdentity(f.identity.id, f.userId);
  await assert.rejects(f.service.retry(f.userId, f.scope.projectId, f.inbox.id), ForbiddenError);
});

dbTest("processed messages and synthetic app drafts cannot be retried through the provider channel", async (f) => {
  await f.db("messaging_agent_inbox").where({ id: f.inbox.id }).update({ status: "processed" });
  await assert.rejects(f.service.retry(f.userId, f.scope.projectId, f.inbox.id), ConflictError);
  await f.db("messaging_agent_inbox").where({ id: f.inbox.id }).update({ status: "failed", origin: "web" });
  await assert.rejects(f.service.retry(f.userId, f.scope.projectId, f.inbox.id), ConflictError);
  assert.equal((await f.repo.inbox(f.inbox.id))?.status, "failed");
  await f.db("messaging_agent_inbox").where({ id: f.inbox.id }).update({ origin: "provider", provider_message_id: `web:${randomUUID()}` });
  assert.equal((await f.service.retry(f.userId, f.scope.projectId, f.inbox.id)).status, "received");
});


dbTest("channel/account mismatches and non-direct conversations cannot retry protected work", async (f) => {
  for (const changed of [{ channel: "another-chat" }, { channel_account_id: "another-account" }, { conversation_type: "group" }]) {
    await f.db("messaging_agent_inbox").where({ id: f.inbox.id }).update(changed);
    await assert.rejects(f.service.retry(f.userId, f.scope.projectId, f.inbox.id), ForbiddenError);
    assert.equal((await f.repo.inbox(f.inbox.id))?.status, "failed");
    await f.db("messaging_agent_inbox").where({ id: f.inbox.id }).update({ channel: f.sender.channel, channel_account_id: f.sender.channelAccountId, conversation_type: "direct" });
  }
});

dbTest("stale app captures fail visibly with their originals retained while provider work remains retryable", async (f) => {
  const past = new Date(Date.now() - 60 * 60_000), fileId = f.id("original_file");
  await f.db("uploaded_files").insert({ id: fileId, owner_id: f.userId, project_id: f.scope.projectId, file_name: "delivery.pdf", mime_type: "application/pdf", size_bytes: 3, storage_path: "fixture/original" });
  const capture = async () => (await f.repo.acceptMessage({ ...f.sender, origin: "web", replyRecipientId: f.sender.senderId, conversationType: "direct", providerMessageId: randomUUID(), type: "attachment", text: "Delivery evidence", sourceFileId: fileId,
    sentAt: new Date(), mediaId: null, mediaMimeType: "application/pdf", replyToMessageId: null }))!;
  const received = await capture(), processing = await capture(), recent = await capture();
  await f.db("messaging_agent_inbox").where({ id: received.id }).update({ created_at: past });
  await f.db("messaging_agent_inbox").whereIn("id", [processing.id, f.inbox.id]).update({ status: "processing", processing_started_at: past });
  assert.equal(await f.repo.recoverInbox(new Date(Date.now() - 15 * 60_000)), 3);
  for (const original of [received, processing]) {
    const row = (await f.repo.inbox(original.id))!;
    assert.equal(row.status, "failed"); assert.equal(row.source_file_id, fileId); assert.match(row.last_error!, /Send the text again.*attachment was retained/);
  }
  assert.equal((await f.repo.inbox(recent.id))!.status, "received");
  assert.equal((await f.repo.inbox(f.inbox.id))!.status, "received");
  assert.ok(await f.db("uploaded_files").where({ id: fileId }).first());
  assert.ok((await f.repo.pendingInbox()).every((row) => row.origin === "provider"));
});
