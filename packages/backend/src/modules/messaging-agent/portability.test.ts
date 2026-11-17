import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { BadRequestError } from "../../lib/errors.ts";
import { withinWhatsAppServiceWindow } from "./adapters/whatsapp/adapter.ts";
import type { MessagingChannelAdapter } from "./channel-types.ts";
import { messagingAdapterRegistry } from "./channels.ts";
import { messagingAgentIntake } from "./intake.ts";
import { createFixture, fixture } from "./test-fixture.ts";
import type { MessagingInboxRow, MessagingInboundMessage, MessagingSendInput } from "./types.ts";

const url = process.env.MESSAGING_AGENT_TEST_DATABASE_URL;

async function inbound(f: Awaited<ReturnType<typeof createFixture>>, adapter: MessagingChannelAdapter, text: string | null, extra: Partial<MessagingInboundMessage> = {}) {
  const message: MessagingInboundMessage = { channel: adapter.channel, channelAccountId: adapter.channelAccountId,
    senderId: f.sender.senderId, replyRecipientId: f.sender.senderId, conversationType: "direct", providerMessageId: randomUUID(),
    sentAt: f.now, type: "text", text, mediaId: null, mediaMimeType: null, replyToMessageId: null, ...extra };
  await messagingAgentIntake(f.db).receive(adapter, { messages: [message], statuses: [] }, f.now);
  const row = await f.db<MessagingInboxRow>("messaging_agent_inbox").where({ channel: adapter.channel, channel_account_id: adapter.channelAccountId,
    provider_message_id: message.providerMessageId, origin: "provider" }).first();
  assert.ok(row); return row;
}

test("a second messaging adapter runs the same intake, text/voice review and exact-once execution with private chat addresses", { skip: !url }, async () => fixture(async (f) => {
  const waSent: MessagingSendInput[] = [], telegramSent: MessagingSendInput[] = [];
  const whatsapp: MessagingChannelAdapter = { ...f.adapter, channel: "whatsapp", label: "WhatsApp fixture", canReply: withinWhatsAppServiceWindow,
    sendText: async (message) => { waSent.push(message); return { status: "accepted", messageId: `reply-${waSent.length}` }; } };
  const telegram: MessagingChannelAdapter = { ...f.adapter, channel: "telegram", label: "Telegram fixture", canReply: () => true,
    sendText: async (message) => { telegramSent.push(message); return { status: "accepted", messageId: `reply-${telegramSent.length}` }; } };
  const worker = f.worker({ adapters: messagingAdapterRegistry([whatsapp, telegram]) });
  const chatId = `private-chat.${randomUUID()}`;
  const code = await f.code({ ...f.sender, channel: whatsapp.channel });
  const wrongChannel = await inbound(f, telegram, `LINK ${code}`, { replyRecipientId: chatId });
  await worker.processInbox(wrongChannel.id);
  assert.equal((await f.repo.inbox(wrongChannel.id))!.status, "failed");
  assert.equal(await f.repo.identityForSender({ ...f.sender, channel: telegram.channel }), null);
  const waLink = await inbound(f, whatsapp, `LINK ${code}`); await worker.processInbox(waLink.id);
  const tgLink = await inbound(f, telegram, `LINK ${await f.code({ ...f.sender, channel: telegram.channel })}`, { replyRecipientId: chatId });
  await worker.processInbox(tgLink.id);
  await worker.processOutbox((await f.reply(waLink.id)).id); await worker.processOutbox((await f.reply(tgLink.id)).id);
  assert.equal(waSent[0]!.to, f.sender.senderId); assert.equal(telegramSent[0]!.to, chatId);
  const source = "Eight workers. Slab poured — 12m³.";
  const textActions = [], voiceProposals = [];
  for (const adapter of [whatsapp, telegram]) {
    const address = adapter.channel === "telegram" ? chatId : f.sender.senderId;
    const text = await inbound(f, adapter, source, { providerMessageId: "web:123", replyRecipientId: address });
    await Promise.all([worker.processInbox(text.id), worker.processInbox(text.id)]);
    assert.equal((await f.repo.inbox(text.id))!.status, "processed");
    const textProposal = await f.db("messaging_agent_proposals").where({ inbox_id: text.id }).first(); assert.ok(textProposal);
    textActions.push((await f.repo.actionsForProposal(textProposal.id, 1))[0]!.payload);
    const voice = await inbound(f, adapter, null, { type: "audio", mediaId: "same-media-id", replyRecipientId: address });
    await worker.processInbox(voice.id);
    const saved = await f.repo.inbox(voice.id); assert.ok(saved!.source_file_id);
    assert.equal(saved!.source_text, source); assert.equal(saved!.source_kind, "voice_translation");
    const proposal = await f.db("messaging_agent_proposals").where({ inbox_id: voice.id }).first(); assert.ok(proposal);
    assert.deepEqual((await f.repo.actionsForProposal(proposal.id, 1))[0]!.payload, textActions[textActions.length - 1]);
    voiceProposals.push(proposal);
  }
  assert.deepEqual(textActions[0], textActions[1]);
  assert.deepEqual(f.effects, { downloads: 2, uploads: 2, translations: 2, drafts: 4 });
  assert.equal(Number((await f.db("daily_log_entries").where({ project_id: f.scope.projectId }).count("*").first())!.count), 0);
  const crossConfirm = await inbound(f, telegram, `CONFIRM ${voiceProposals[0]!.id} 1`, { replyRecipientId: chatId });
  await worker.processInbox(crossConfirm.id); assert.equal((await f.repo.inbox(crossConfirm.id))!.status, "failed");
  for (const [index, adapter] of [whatsapp, telegram].entries()) {
    const confirmation = await inbound(f, adapter, `CONFIRM ${voiceProposals[index]!.id} 1`, { replyRecipientId: adapter.channel === "telegram" ? chatId : f.sender.senderId });
    await Promise.all([worker.processInbox(confirmation.id), worker.processInbox(confirmation.id)]);
    assert.equal((await f.repo.proposal(voiceProposals[index]!.id))!.status, "completed");
  }
  assert.equal(Number((await f.db("daily_log_entries").where({ project_id: f.scope.projectId }).count("*").first())!.count), 2);
  await messagingAgentIntake(f.db).receive(telegram, { messages: [], statuses: [{ channel: telegram.channel, channelAccountId: telegram.channelAccountId,
    providerMessageId: "reply-1", recipientId: chatId, status: "read", sentAt: f.now }] });
  assert.equal((await f.reply(tgLink.id)).status, "read"); assert.equal((await f.reply(waLink.id)).status, "accepted");
}));

test("reply windows and message limits are supplied by each adapter rather than imposed by the core", { skip: !url }, async () => fixture(async (f) => {
  const whatsapp: MessagingChannelAdapter = { ...f.adapter, channel: "whatsapp", canReply: withinWhatsAppServiceWindow };
  const longer: MessagingChannelAdapter = { ...f.adapter, channel: "long-messenger", maxTextLength: 8192, canReply: () => true };
  const worker = f.worker({ adapters: messagingAdapterRegistry([whatsapp, longer]) });
  const wa = await f.link({ ...f.sender, channel: whatsapp.channel });
  const other = await f.link({ ...f.sender, channel: longer.channel });
  const longText = "x".repeat(5000);
  const shortLimit = await inbound(f, whatsapp, longText); await worker.processInbox(shortLimit.id);
  assert.equal((await f.repo.inbox(shortLimit.id))!.status, "processed");
  const shortParts = await f.db("messaging_agent_outbox").where({ inbox_id: shortLimit.id }).orderBy("part_index");
  assert.ok(shortParts.length > 1); assert.ok(shortParts.every((part) => part.body.length <= whatsapp.maxTextLength));
  assert.ok(shortParts.map((part) => part.body).join("").includes(longText));
  const longLimit = await inbound(f, longer, longText); await worker.processInbox(longLimit.id);
  assert.equal((await f.repo.inbox(longLimit.id))!.status, "processed");
  const review = await f.reply(longLimit.id); assert.ok(review.body.length > 4096); assert.match(review.body, new RegExp(longText));
  await f.db("messaging_agent_identity_links").whereIn("id", [wa.identity.id, other.identity.id]).update({ last_inbound_at: new Date(f.now.getTime() - 25 * 60 * 60_000) });
  const waReply = await f.reply(shortLimit.id); await worker.processOutbox(waReply.id);
  await worker.processOutbox(review.id);
  assert.equal((await f.repo.outbox(waReply.id))!.status, "cancelled");
  assert.equal((await f.repo.outbox(review.id))!.status, "accepted");
  const proposal = await f.db("messaging_agent_proposals").where({ inbox_id: longLimit.id }).first(); assert.ok(proposal);
  const confirm = await inbound(f, longer, `CONFIRM ${proposal.id} 1`); await worker.processInbox(confirm.id);
  assert.equal((await f.repo.proposal(proposal.id))!.status, "completed");
}));

test("group intake never reaches the planner, audio storage, execution or a protected outbound reply", { skip: !url }, async () => fixture(async (f) => {
  const linked = await f.link(); const worker = f.worker();
  const old = new Date(f.now.getTime() - 2 * 60 * 60_000);
  await f.db("messaging_agent_identity_links").where({ id: linked.identity.id }).update({ last_inbound_at: old });
  for (const type of ["text", "audio"] as const) {
    const inbox = await inbound(f, f.adapter, type === "text" ? "Concrete placed" : null, { conversationType: "group", replyRecipientId: "group-chat", type, mediaId: type === "audio" ? "private-audio" : null });
    await worker.processInbox(inbox.id);
    assert.equal((await f.repo.inbox(inbox.id))!.status, "failed");
    assert.equal(await f.reply(inbox.id), undefined);
    const outbox = await f.repo.enqueueOutbox({ inboxId: inbox.id, identityId: linked.identity.id, conversationId: linked.conversation.id,
      recipientId: inbox.reply_recipient_id, body: "Protected project facts", scopeVersion: linked.conversation.scope_version, idempotencyKey: inbox.id });
    await worker.processOutbox(outbox.id); assert.equal((await f.repo.outbox(outbox.id))!.status, "cancelled");
  }
  assert.deepEqual(f.effects, { downloads: 0, uploads: 0, translations: 0, drafts: 0 }); assert.equal(f.sent.length, 0);
  assert.equal(new Date((await f.repo.identityForSender(f.sender))!.last_inbound_at!).getTime(), old.getTime());
  assert.equal(Number((await f.db("daily_log_entries").where({ project_id: f.scope.projectId }).count("*").first())!.count), 0);
}));

test("verified account pinning is atomic and replay cannot reopen a reply window", { skip: !url }, async () => fixture(async (f) => {
  const linked = await f.link(); const intake = messagingAgentIntake(f.db);
  const initial = new Date(f.now.getTime() - 6 * 60 * 60_000);
  await f.db("messaging_agent_identity_links").where({ id: linked.identity.id }).update({ last_inbound_at: initial });
  const message: MessagingInboundMessage = { ...f.sender, replyRecipientId: f.sender.senderId, conversationType: "direct", providerMessageId: "stable-id",
    sentAt: new Date(f.now.getTime() - 2 * 60 * 60_000), type: "text", text: "Work", mediaId: null, mediaMimeType: null, replyToMessageId: null };
  await assert.rejects(intake.receive(f.adapter, { messages: [message, { ...message, channel: "another-channel" }], statuses: [] }), BadRequestError);
  await assert.rejects(intake.receive(f.adapter, { messages: [{ ...message, origin: "web" }], statuses: [] }), BadRequestError);
  assert.equal(Number((await f.db("messaging_agent_inbox").where({ sender_id: f.sender.senderId }).count("*").first())!.count), 0);
  await intake.receive(f.adapter, { messages: [message], statuses: [] }, f.now);
  await intake.receive(f.adapter, { messages: [{ ...message, sentAt: new Date(f.now.getTime() + 60_000) }], statuses: [] }, f.now);
  assert.equal(new Date((await f.repo.identityForSender(f.sender))!.last_inbound_at!).getTime(), message.sentAt.getTime());
  assert.equal(Number((await f.db("messaging_agent_inbox").where({ sender_id: f.sender.senderId }).count("*").first())!.count), 1);
}));
