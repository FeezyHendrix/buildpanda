import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestError } from "../../../../lib/errors.ts";
import { parseTelegramUpdate } from "./normalize.ts";
import { parseTelegramMessageId, telegramCallbackMessageId } from "./identifiers.ts";

const settings = { enabled: true, botToken: "123456:token", botId: "123456", botUsername: "buildpanda_bot", webhookSecret: "webhook-secret" };
const base = { message_id: 10, date: 1794657600, chat: { id: 701, type: "private" }, from: { id: 701, is_bot: false, first_name: "Site" } };
const parse = (message: Record<string, unknown>) => parseTelegramUpdate({ update_id: 1, message: { ...base, ...message } }, settings);
const pressedAt = new Date("2026-11-16T15:00:00.000Z");
const callback = {
  id: "press-1", from: base.from, data: "CONFIRM proposal_1 2",
  message: { ...base, from: { id: Number(settings.botId), is_bot: true } },
};
const press = (value: Record<string, unknown> = {}) => parseTelegramUpdate({ update_id: 1, callback_query: { ...callback, ...value } }, settings, pressedAt);

test("private text preserves provider actor, chat routing, message identity, timestamp and replies", () => {
  const text = "<p>Site &amp; voice /files/provider-reference/download</p>";
  const events = parse({ text, reply_to_message: { message_id: 9 } });
  assert.deepEqual(events, { messages: [{
    channel: "telegram", channelAccountId: "123456", senderId: "tg:701:701", replyRecipientId: "tg:701:701",
    conversationType: "direct", providerMessageId: "tg:701:10", sentAt: new Date("2026-11-14T12:00:00.000Z"),
    type: "text", text, mediaId: null, mediaMimeType: null, replyToMessageId: "tg:701:9",
  }], statuses: [] });
  const second = parse({ chat: { id: 702, type: "private" }, from: { id: 702, is_bot: false }, text });
  assert.notEqual(second.messages[0]!.providerMessageId, events.messages[0]!.providerMessageId);
});

test("Telegram voice and audio preserve downloadable file IDs and supported MIME types", () => {
  for (const kind of ["voice", "audio"]) {
    const message = parse({ [kind]: { file_id: "Audio_File-123", mime_type: "audio/OGG; codecs=opus", duration: 10 } }).messages[0]!;
    assert.equal(message.type, "audio");
    assert.equal(message.mediaId, "tg:ogg:Audio_File-123");
    assert.equal(message.mediaMimeType, "audio/ogg");
    assert.equal(message.text, null);
    const withoutMime = parse({ [kind]: { file_id: "Audio_File-123", duration: 10 } }).messages[0]!;
    assert.equal(withoutMime.type, "audio");
    assert.equal(withoutMime.mediaId, "tg:audio:Audio_File-123");
    assert.equal(withoutMime.mediaMimeType, null);
    assert.equal(parse({ [kind]: { file_id: "Audio_File-123", mime_type: "video/mp4" } }).messages[0]!.type, "unsupported");
  }
  const unsupported = parse({ document: { file_id: "pdf" }, caption: "Not a daily log" }).messages[0]!;
  assert.equal(unsupported.type, "unsupported");
  assert.equal(unsupported.text, null);
});

test("Telegram commands reach shared commands, and commands addressed to other bots are ignored", () => {
  const code = "a".repeat(32);
  for (const [text, expected] of [
    [`/start ${code}`, `LINK ${code}`], [`/link@buildpanda_bot ${code}`, `LINK ${code}`],
    ["/start", "HELP"], ["/start invalid", "HELP"], ["/help@BuildPanda_Bot", "HELP"], ["/stop", "STOP"],
    ["/confirm proposal_1 2", "CONFIRM proposal_1 2"], ["/cancel proposal_1 2", "CANCEL proposal_1 2"],
    ["Pour concrete tomorrow", "Pour concrete tomorrow"],
  ]) assert.equal(parse({ text }).messages[0]!.text, expected);
  assert.equal(parse({ text: `/start@another_bot ${code}` }).messages.length, 0);
  assert.equal(parse({ text: "/stop@another_bot" }).messages.length, 0);
});

test("groups, channels, bots, business messages and edited/irrelevant updates cannot act as private users", () => {
  for (const type of ["group", "supergroup", "channel"]) {
    assert.equal(parse({ chat: { id: -1001, type }, text: "STOP" }).messages.length, 0);
  }
  assert.equal(parse({ from: { id: 701, is_bot: true }, text: "STOP" }).messages.length, 0);
  assert.equal(parse({ sender_chat: { id: 701 }, text: "STOP" }).messages.length, 0);
  assert.equal(parse({ business_connection_id: "business", text: "STOP" }).messages.length, 0);
  for (const topic of [{ message_thread_id: 2 }, { direct_messages_topic: { topic_id: 2 } }, { is_topic_message: true }]) {
    assert.equal(parse({ ...topic, text: "STOP" }).messages.length, 0);
  }
  for (const field of ["edited_message", "business_message", "channel_post"]) {
    assert.deepEqual(parseTelegramUpdate({ update_id: 1, [field]: { ...base, text: "STOP" } }, settings), { messages: [], statuses: [] });
  }
});

test("private review callbacks keep actor, bot message and press identity separate", () => {
  for (const command of ["CONFIRM proposal_1 2", "CANCEL proposal_1 2", "CONFIRM proposal_1 1"]) {
    const events = press({ data: command });
    assert.deepEqual(events, { messages: [{
      channel: "telegram", channelAccountId: settings.botId, senderId: "tg:701:701", replyRecipientId: "tg:701:701",
      conversationType: "direct", providerMessageId: telegramCallbackMessageId(701, 10, callback.id),
      sentAt: pressedAt, type: "text", text: command, mediaId: null, mediaMimeType: null, replyToMessageId: "tg:701:10",
    }], statuses: [], callbackQueryId: callback.id });
    assert.deepEqual(parseTelegramMessageId(events.messages[0]!.providerMessageId), { chatId: 701, messageId: 10 });
    assert.notEqual(events.messages[0]!.sentAt.getTime(), base.date * 1000);
  }
  assert.equal(press().messages[0]!.providerMessageId, press().messages[0]!.providerMessageId);
  assert.notEqual(press().messages[0]!.providerMessageId, press({ id: "press-2" }).messages[0]!.providerMessageId);
});

test("callback data cannot turn unsupported actors, messages or arbitrary commands into a review action", () => {
  const ignored = { messages: [], statuses: [] };
  for (const change of [
    { from: { ...callback.from, is_bot: true } }, { from: { ...callback.from, id: 702 } },
    { message: undefined }, { message: { ...callback.message, from: undefined } },
    { message: { ...callback.message, from: { id: Number(settings.botId), is_bot: false } } },
    { message: { ...callback.message, from: { id: 999, is_bot: true } } },
    { message: { ...callback.message, chat: { id: -701, type: "group" } } },
    { inline_message_id: "inline-message" }, { game_short_name: "game" },
    ...["STOP", "LINK secret", "daily log", "/confirm proposal_1 1", "CONFIRM proposal_1 0", "CONFIRM proposal_1 1\nSTOP", "x".repeat(65), null, {}].map((data) => ({ data })),
    ...[{ sender_chat: { id: 701 } }, { business_connection_id: "business" }, { message_thread_id: 2 }, { direct_messages_topic: { topic_id: 2 } }, { is_topic_message: true }]
      .map((message) => ({ message: { ...callback.message, ...message } })),
  ]) assert.deepEqual(press(change), ignored);
  assert.deepEqual(parseTelegramUpdate({ update_id: 1, message: { ...base, text: "STOP" }, callback_query: callback }, settings), ignored);
  for (const id of ["", "x".repeat(257), "has\nnewline"]) assert.throws(() => press({ id }), BadRequestError);
});

test("malformed update identities, dates and content fail validation without echoing sensitive values", () => {
  for (const payload of [null, {}, { update_id: "1" }, { update_id: 1, message: {} }]) {
    assert.throws(() => parseTelegramUpdate(payload, settings), BadRequestError);
  }
  for (const message of [
    { message_id: 0 }, { message_id: Number.MAX_SAFE_INTEGER + 1 }, { date: 9_000_000_000_000_000 },
    { from: undefined }, { from: { id: 702, is_bot: false } }, { text: "x".repeat(8001) },
    { voice: { file_id: "" } },
  ]) assert.throws(() => parse(message), BadRequestError);
});
