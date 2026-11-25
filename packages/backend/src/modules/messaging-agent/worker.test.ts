import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { normalizeReview } from "./draft.ts";
import { linkCodeHash } from "./service.ts";
import { messagingAdapterRegistry } from "./channels.ts";
import type { MessagingWorkerOptions } from "./worker-types.ts";
import type { MessagingSendInput } from "./types.ts";
import { fixture } from "./test-fixture.ts";

const url = process.env.MESSAGING_AGENT_TEST_DATABASE_URL;
function dbTest(name: string, run: Parameters<typeof fixture>[0]) { test(name, { skip: !url }, () => fixture(run)); }

dbTest("LINK reauthorizes its bound scope and preserves actual inbound time; STOP prevents later sends", async (f) => {
  const code = await f.code();
  const inboundAt = new Date(f.now.getTime() - 60 * 60_000);
  const inbox = await f.receive(`LINK ${code}`, { sentAt: inboundAt });
  assert.equal(inbox.source_text, "LINK [code redacted]"); assert.equal(inbox.link_code_hash, linkCodeHash(code));
  const worker = f.worker(); await worker.processInbox(inbox.id);
  const identity = await f.repo.identityForSender(f.sender);
  assert.ok(identity); assert.equal(new Date(identity.last_inbound_at!).getTime(), inboundAt.getTime());
  const response = await f.reply(inbox.id); assert.match(response.body, /Authorized project/); assert.match(response.body, /Selected building/);
  await worker.processOutbox(response.id); assert.equal(f.sent.length, 1);
  const stop = await f.receive("STOP"); await worker.processInbox(stop.id);
  assert.ok((await f.repo.identityForSender(f.sender))?.opted_out_at);
  assert.equal(await f.reply(stop.id), undefined);
  const ignored = await f.receive("Concrete placed"); await worker.processInbox(ignored.id);
  assert.equal(f.effects.drafts, 0);
});

dbTest("revoked grants block LINK before consuming the code", async (f) => {
  const code = await f.code();
  await f.db("project_participants").where({ user_id: f.userId }).delete();
  const inbox = await f.receive(`LINK ${code}`); await f.worker().processInbox(inbox.id);
  assert.equal(await f.repo.identityForSender(f.sender), null);
  assert.ok(await f.repo.readLinkCode(linkCodeHash(code), f.sender, f.now));
  assert.equal((await f.repo.inbox(inbox.id))?.status, "failed");
});

dbTest("text and voice draft equal review actions, persist original audio, and save only after explicit confirmation", async (f) => {
  await f.link(); const worker = f.worker();
  const text = await f.receive("Eight workers. Slab poured — 12m³.");
  await Promise.all([worker.processInbox(text.id), worker.processInbox(text.id)]);
  assert.equal(f.effects.drafts, 1);
  const voice = await f.receive(null, { type: "audio", mediaId: "media.1", mediaMimeType: "audio/ogg" });
  await worker.processInbox(voice.id);
  const source = await f.repo.inbox(voice.id); assert.ok(source?.source_file_id);
  assert.equal(source.source_kind, "voice_translation"); assert.equal(source.source_text, text.source_text);
  assert.deepEqual(f.effects, { downloads: 1, uploads: 1, translations: 1, drafts: 2 });
  assert.equal(Number((await f.db("daily_log_entries").where({ project_id: f.scope.projectId }).count("*").first())!.count), 0);
  const proposal = await f.db("messaging_agent_proposals").where({ inbox_id: voice.id }).first();
  assert.match((await f.reply(voice.id)).body, /translated to English/);
  const confirm = await f.receive(`CONFIRM ${proposal.id} ${proposal.version}`);
  await Promise.all([worker.processInbox(confirm.id), worker.processInbox(confirm.id)]);
  assert.equal((await f.repo.proposal(proposal.id))?.status, "completed");
  assert.equal(Number((await f.db("daily_log_entries").where({ project_id: f.scope.projectId }).count("*").first())!.count), 1);
  assert.match((await f.reply(confirm.id)).body, /Saved 1 daily-log action/);
});

dbTest("translation failure retries automatically, then retains original audio and a deliberate retry reuses the stored file", async (f) => {
  await f.link();
  const inbox = await f.receive(null, { type: "audio", mediaId: "media.1" });
  const failing = f.worker({ translate: async () => { throw new Error("speech unavailable"); } });
  for (const attempt of [1, 2]) {
    await failing.processInbox(inbox.id);
    const row = await f.repo.inbox(inbox.id);
    assert.equal(row?.status, "received"); assert.equal(row?.attempts, attempt);
    assert.equal(await f.db("messaging_agent_outbox").where({ inbox_id: inbox.id }).count("* as n").first().then((r) => Number(r?.n)), 0);
  }
  await failing.processInbox(inbox.id);
  assert.equal((await f.repo.inbox(inbox.id))?.status, "failed");
  assert.ok((await f.repo.inbox(inbox.id))?.source_file_id);
  assert.equal(f.effects.drafts, 0);
  assert.equal(await f.repo.retryInbox(inbox.id), true);
  await f.worker().processInbox(inbox.id);
  assert.equal((await f.repo.inbox(inbox.id))?.status, "processed");
  assert.equal(f.effects.downloads, 1); assert.equal(f.effects.uploads, 1); assert.equal(f.effects.drafts, 1);
  const replies = await f.db("messaging_agent_outbox").where({ inbox_id: inbox.id });
  assert.equal(replies.length, 2);
  assert.equal(replies.find((row) => row.idempotency_key.endsWith(":error"))?.status, "cancelled");
  const review = replies.find((row) => row.idempotency_key.includes(":proposal:")); assert.ok(review);
  assert.match(review.body, /Review/);
  await f.worker().tickOutbox(); assert.equal(f.sent.length, 1); assert.match(f.sent[0]!, /Review/);
});

dbTest("immutable scope and revoked permissions block delayed text or audio before model/media work", async (f) => {
  const linked = await f.link();
  const old = await f.receive(null, { type: "audio", mediaId: "media.1" });
  await f.repo.setScope(linked.conversation.id, f.otherScope);
  await f.worker().processInbox(old.id);
  assert.equal((await f.repo.inbox(old.id))?.status, "failed"); assert.equal(f.effects.downloads, 0);
  const current = await f.receive("Concrete placed");
  await f.db("project_participants").where({ user_id: f.userId }).delete();
  await f.worker().processInbox(current.id);
  assert.equal((await f.repo.inbox(current.id))?.status, "failed"); assert.equal(f.effects.drafts, 0);
});

dbTest("outbox refuses stale scope, lost grants, opt-out, an expired adapter window and an unavailable account", async (f) => {
  const linked = await f.link();
  async function outgoing() {
    const inbox = await f.receive("HELP");
    await f.worker().processInbox(inbox.id);
    return (await f.reply(inbox.id)).id as string;
  }
  const expired = await outgoing();
  await f.db("messaging_agent_identity_links").where({ id: linked.identity.id }).update({ last_inbound_at: new Date(f.now.getTime() - 25 * 60 * 60_000) });
  await f.worker().processOutbox(expired); assert.equal((await f.repo.outbox(expired))?.status, "cancelled");
  await f.repo.touchIdentity(linked.identity.id, f.now);
  const rotated = await outgoing();
  await f.worker({ adapters: messagingAdapterRegistry([{ ...f.adapter, channelAccountId: "different-account" }]) }).processOutbox(rotated);
  assert.equal((await f.repo.outbox(rotated))?.status, "cancelled");
  const stale = await outgoing(); await f.repo.setScope(linked.conversation.id, f.otherScope);
  await f.worker().processOutbox(stale); assert.equal((await f.repo.outbox(stale))?.status, "cancelled");
  const denied = await outgoing(); await f.db("project_participants").where({ user_id: f.userId }).delete();
  await f.worker().processOutbox(denied); assert.equal((await f.repo.outbox(denied))?.status, "cancelled");
  const optedOut = await outgoing(); await f.repo.setOptOut(linked.identity.id, true);
  await f.worker().processOutbox(optedOut); assert.equal((await f.repo.outbox(optedOut))?.status, "cancelled");
  assert.equal(f.sent.length, 0);
});

dbTest("unknown provider acceptance is quarantined and never sent again by replay or sweep", async (f) => {
  await f.link(); const inbox = await f.receive("HELP"); const worker = f.worker();
  await worker.processInbox(inbox.id); const outbox = await f.reply(inbox.id);
  f.setOutcome({ status: "unknown", reason: "Provider timeout" });
  await Promise.all([worker.processOutbox(outbox.id), worker.processOutbox(outbox.id)]);
  await worker.processOutbox(outbox.id); await worker.tickOutbox();
  assert.equal((await f.repo.outbox(outbox.id))?.status, "unknown"); assert.equal(f.sent.length, 1);
});

dbTest("long reviews never save truncated facts, and web drafts are not stolen by the provider worker", async (f) => {
  await f.link(); const worker = f.worker();
  const long = await f.receive("Original source");
  const draft: NonNullable<MessagingWorkerOptions["draft"]> = async (_text, scope) => normalizeReview([
    { kind: "daily_log", title: "Site note", payload: { logDate: "2026-11-14", buildingId: scope.buildingId, bodyText: "x".repeat(5000) } },
  ], scope);
  await f.worker({ draft }).processInbox(long.id);
  assert.equal((await f.repo.inbox(long.id))?.status, "processed");
  const parts = await f.db("messaging_agent_outbox").where({ inbox_id: long.id }).orderBy("part_index");
  assert.ok(parts.length > 1);
  assert.ok(parts.map((part) => part.body).join("").includes("x".repeat(5000)));
  assert.equal(parts.filter((part) => part.buttons).length, 1);
  assert.ok(parts.at(-1).buttons);
  assert.equal(Number((await f.db("daily_logs").where({ project_id: f.scope.projectId }).count("*").first())!.count), 0);
  const web = await f.receive("App draft", { providerMessageId: `web:${randomUUID()}`, origin: "web" });
  await worker.processInbox(web.id); assert.equal((await f.repo.inbox(web.id))?.status, "received");
});

dbTest("review buttons survive the outbox and repeated confirmations save once", async (f) => {
  await f.link(); const calls: MessagingSendInput[] = [];
  const worker = f.worker({ adapters: messagingAdapterRegistry([{ ...f.adapter,
    sendText: async (message) => { calls.push(message); return { status: "accepted", messageId: randomUUID() }; },
  }]) });
  const source = await f.receive("Eight workers.\n\nSlab poured — 12m³."); await worker.processInbox(source.id);
  const review = await f.reply(source.id);
  assert.deepEqual(review.buttons.map((button: { label: string }) => button.label), ["Confirm", "Cancel"]);
  assert.ok(review.body.includes(source.source_text));
  await worker.processOutbox(review.id);
  assert.equal((await f.repo.outbox(review.id))?.status, "accepted"); assert.deepEqual(calls[0]?.buttons, review.buttons);
  const first = await f.receive(review.buttons[0].command); await worker.processInbox(first.id);
  const repeated = await f.receive(review.buttons[0].command); await worker.processInbox(repeated.id);
  assert.equal((await f.reply(first.id)).buttons, null); assert.equal((await f.reply(repeated.id)).buttons, null);
  assert.equal(Number((await f.db("daily_log_entries").where({ project_id: f.scope.projectId }).count("*").first())!.count), 1);
  const cancelSaved = await f.receive(review.buttons[1].command); await worker.processInbox(cancelSaved.id);
  assert.equal((await f.repo.inbox(cancelSaved.id))?.status, "failed");
  assert.equal(Number((await f.db("daily_log_entries").where({ project_id: f.scope.projectId }).count("*").first())!.count), 1);
});

dbTest("changed reviews cancel stale queued buttons and reject stale taps", async (f) => {
  await f.link(); const worker = f.worker();
  const first = await f.receive("Four workers."); await worker.processInbox(first.id);
  const oldReview = await f.reply(first.id);
  const correction = await f.receive("Correction: eight workers."); await worker.processInbox(correction.id);
  const latest = await f.reply(correction.id); assert.notDeepEqual(latest.buttons, oldReview.buttons);
  await worker.processOutbox(oldReview.id); assert.equal((await f.repo.outbox(oldReview.id))?.status, "cancelled");
  assert.equal(f.sent.length, 0);
  const staleTap = await f.receive(oldReview.buttons[0].command); await worker.processInbox(staleTap.id);
  assert.equal((await f.repo.inbox(staleTap.id))?.status, "failed");
  assert.equal(Number((await f.db("daily_log_entries").where({ project_id: f.scope.projectId }).count("*").first())!.count), 0);
  await worker.processOutbox(latest.id); assert.equal((await f.repo.outbox(latest.id))?.status, "accepted");
  assert.equal(f.sent.length, 1);
});

dbTest("button message limits retain the full source without saving truncated facts", async (f) => {
  await f.link(); const text = "Full source: " + "x".repeat(1000);
  const source = await f.receive(text);
  await f.worker({ adapters: messagingAdapterRegistry([{ ...f.adapter, maxButtonTextLength: 1024 }]) }).processInbox(source.id);
  assert.equal((await f.repo.inbox(source.id))?.status, "processed");
  assert.equal((await f.repo.inbox(source.id))?.source_text, text);
  const parts = await f.db("messaging_agent_outbox").where({ inbox_id: source.id }).orderBy("part_index");
  assert.equal(parts.length, 2); assert.ok(parts[0].body.includes(text)); assert.equal(parts[0].buttons, null);
  assert.ok(parts[1].buttons); assert.ok(parts[1].body.length <= 1024);
  assert.equal(Number((await f.db("daily_log_entries").where({ project_id: f.scope.projectId }).count("*").first())!.count), 0);
  assert.equal(Number((await f.db("messaging_agent_proposals").where({ inbox_id: source.id }).count("*").first())!.count), 1);
});

dbTest("button metadata cannot deliver another connection's review", async (f) => {
  await f.link(); const worker = f.worker();
  const own = await f.receive("Own draft."); await worker.processInbox(own.id);
  const ownReply = await f.reply(own.id);
  const otherSender = { ...f.sender, senderId: `US.${randomUUID()}` }; await f.link(otherSender);
  const other = await f.receive("Other connection draft.", { ...otherSender, replyRecipientId: otherSender.senderId });
  await worker.processInbox(other.id); const otherReply = await f.reply(other.id);
  await f.db("messaging_agent_outbox").where({ id: ownReply.id }).update({ buttons: JSON.stringify(otherReply.buttons) });
  await worker.processOutbox(ownReply.id);
  assert.equal((await f.repo.outbox(ownReply.id))?.status, "cancelled"); assert.equal(f.sent.length, 0);
});
