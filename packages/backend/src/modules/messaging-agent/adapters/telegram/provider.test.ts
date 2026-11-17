import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestError } from "../../../../lib/errors.ts";
import { telegramProvider } from "./provider.ts";
import type { MessagingReplyButton } from "../../types.ts";
import {
  parseTelegramMediaId, parseTelegramMessageId, parseTelegramSenderId,
  telegramAudioFormat, telegramCallbackMessageId, telegramMediaId, telegramMessageId, telegramSenderId,
} from "./identifiers.ts";

const settings = { botId: "123456", botToken: "123456:fake_token_for_injected_fetch_only", maxMediaBytes: 8 };
const input = { to: telegramSenderId(42, 42), text: "Saved <daily log> *verbatim*", replyToMessageId: telegramMessageId(42, 7) };
const buttons: MessagingReplyButton[] = [
  { label: "Confirm", command: "CONFIRM maproposal_00000000-0000-4000-8000-000000000000 1" },
  { label: "Cancel", command: "CANCEL maproposal_00000000-0000-4000-8000-000000000000 1" },
];
const mediaId = telegramMediaId("file_ABC-123", "audio/ogg");
const metadata = (fields: object = {}) => Response.json({ ok: true, result: {
  file_id: "file_ABC-123", file_path: "voice/file_1.oga", file_size: 3, ...fields,
} });
const accepted = (fields: object = {}) => Response.json({ ok: true, result: {
  message_id: 8, chat: { id: 42, type: "private" }, ...fields,
} });

test("identities keep private user, chat and per-chat message ids together", () => {
  assert.equal(telegramSenderId(42, 42), "tg:42:42");
  assert.deepEqual(parseTelegramSenderId("tg:42:42"), { chatId: 42, userId: 42 });
  assert.deepEqual(parseTelegramMessageId(telegramMessageId(42, 7)), { chatId: 42, messageId: 7 });
  assert.notEqual(telegramMessageId(42, 7), telegramMessageId(43, 7));
  const callback = telegramCallbackMessageId(42, 7, "query-id");
  assert.deepEqual(parseTelegramMessageId(callback), { chatId: 42, messageId: 7 });
  assert.notEqual(callback, telegramCallbackMessageId(42, 7, "another-press"));
  for (const id of ["42", "@someone", "tg:-42:42", "tg:42:43", "tg:042:042", "tg:9007199254740992:9007199254740992"]) {
    assert.throws(() => parseTelegramSenderId(id), /Telegram/);
  }
  assert.throws(() => telegramSenderId(42, 43), /private/);
  assert.throws(() => telegramMessageId(42, 0), /identity/);
  assert.throws(() => parseTelegramMessageId("tg:42:0"), /identity/);
});

test("audio identities preserve MIME, optionally defer it and reject unsupported input", () => {
  assert.deepEqual(parseTelegramMediaId(mediaId), { fileId: "file_ABC-123", mimeType: "audio/ogg", extension: "ogg" });
  assert.deepEqual(parseTelegramMediaId(telegramMediaId("file_ABC-123")), { fileId: "file_ABC-123" });
  assert.deepEqual(telegramAudioFormat(" Audio/OGG; codecs=opus "), { mimeType: "audio/ogg", extension: "ogg" });
  assert.deepEqual(parseTelegramMediaId(telegramMediaId("file", "audio/x-wav")), { fileId: "file", mimeType: "audio/x-wav", extension: "wav" });
  for (const mime of ["text/plain", "__proto__", "constructor"]) assert.throws(() => telegramMediaId("file", mime), /Unsupported/);
  for (const file of ["../file", "https://evil.example/file", "x".repeat(513)]) assert.throws(() => telegramMediaId(file), /identity/);
  assert.throws(() => parseTelegramMediaId("tg:html:file"), /identity/);
});

test("send uses official JSON API, plain text and a decoded same-chat reply", async () => {
  let calls = 0;
  const provider = telegramProvider(settings, async (url, init) => {
    calls++;
    assert.equal(String(url), `https://api.telegram.org/bot${settings.botToken}/sendMessage`);
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("content-type"), "application/json");
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    assert.deepEqual(JSON.parse(String(init?.body)), {
      chat_id: 42, text: input.text, reply_parameters: { message_id: 7, allow_sending_without_reply: true },
    });
    return accepted();
  });
  assert.deepEqual(await provider.sendText(input), { status: "accepted", messageId: "tg:42:8" });
  assert.equal(calls, 1);
});

test("send rejects invalid recipients, oversized text and foreign replies without a request", async () => {
  let calls = 0;
  const provider = telegramProvider(settings, async () => { calls++; return accepted(); });
  for (const invalid of [
    { ...input, to: "42" }, { ...input, to: "tg:42:43" }, { ...input, text: "" },
    { ...input, text: "x".repeat(4097) }, { ...input, replyToMessageId: "tg:43:7" }, { ...input, replyToMessageId: "7" },
  ]) {
    const result = await provider.sendText(invalid);
    assert.equal(result.status, "rejected");
    if (result.status === "rejected") assert.equal(result.retryable, false);
  }
  assert.equal(calls, 0);
  const plain = telegramProvider(settings, async (_url, init) => {
    assert.deepEqual(JSON.parse(String(init?.body)), { chat_id: 42, text: "x".repeat(4096) });
    return accepted();
  });
  assert.equal((await plain.sendText({ to: input.to, text: "x".repeat(4096) })).status, "accepted");
});

test("review buttons use native inline callbacks and callback replies stay in the same chat", async () => {
  let calls = 0;
  const provider = telegramProvider(settings, async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    assert.equal(body.parse_mode, undefined);
    assert.equal(body.text, input.text);
    assert.deepEqual(body.reply_parameters, { message_id: 7, allow_sending_without_reply: true });
    assert.deepEqual(body.reply_markup, { inline_keyboard: [[
      { text: "Confirm", callback_data: buttons[0]!.command },
      { text: "Cancel", callback_data: buttons[1]!.command },
    ]] });
    assert.ok(body.reply_markup.inline_keyboard[0].every((button: { callback_data: string }) => Buffer.byteLength(button.callback_data) <= 64));
    return accepted();
  });
  assert.equal((await provider.sendText({ ...input, buttons, replyToMessageId: telegramCallbackMessageId(42, 7, "press-1") })).status, "accepted");
  assert.equal((await provider.sendText({ ...input, buttons, replyToMessageId: telegramCallbackMessageId(43, 7, "press-1") })).status, "rejected");
  assert.equal(calls, 1);
});

test("malformed, mismatched or oversized review callbacks are rejected before sending", async () => {
  let calls = 0;
  const provider = telegramProvider(settings, async () => { calls++; return accepted(); });
  const invalid: unknown[] = [
    [], [buttons[0]], [...buttons, buttons[0]],
    [{ ...buttons[0], command: "STOP" }, buttons[1]],
    [{ ...buttons[0], command: "CONFIRM proposal 0" }, { ...buttons[1], command: "CANCEL proposal 0" }],
    [buttons[0], { ...buttons[1], command: "CANCEL another-proposal 1" }],
    [buttons[0], { ...buttons[1], command: buttons[1]!.command.replace(/ 1$/, " 2") }],
    [{ label: "Cancel", command: buttons[0]!.command }, buttons[1]],
    [{ label: "Confirm", command: `CONFIRM ${"x".repeat(70)} 1` }, { label: "Cancel", command: `CANCEL ${"x".repeat(70)} 1` }],
  ];
  for (const value of invalid) assert.equal((await provider.sendText({ ...input, buttons: value as MessagingReplyButton[] })).status, "rejected");
  assert.equal(calls, 0);
});

test("callback acknowledgement is bounded, sends no user notification and hides transport details", async () => {
  const provider = telegramProvider(settings, async (url, init) => {
    assert.equal(String(url), `https://api.telegram.org/bot${settings.botToken}/answerCallbackQuery`);
    assert.deepEqual(JSON.parse(String(init?.body)), { callback_query_id: "press-1" });
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    return Response.json({ ok: true, result: true });
  });
  await provider.answerCallbackQuery("press-1");
  for (const fetcher of [
    async () => { throw new Error(`https://api.telegram.org/bot${settings.botToken}/answerCallbackQuery`); },
    async () => Response.json({ ok: false, description: settings.botToken }, { status: 400 }),
    async () => Response.json({ ok: true, result: false }),
  ]) await assert.rejects(telegramProvider(settings, fetcher).answerCallbackQuery("press-1"), (error: Error) => {
    assert.equal(error.message, "Telegram callback could not be acknowledged");
    assert.equal(error.cause, undefined);
    return true;
  });
  let requests = 0;
  const noFetch = telegramProvider(settings, async () => { requests++; return Response.json({ ok: true, result: true }); });
  for (const id of ["", "x".repeat(257), "has\nnewline"]) await assert.rejects(noFetch.answerCallbackQuery(id), /could not be acknowledged/);
  assert.equal(requests, 0);
});

test("explicit HTTP and Bot API failures are rejected with generic reasons", async () => {
  for (const code of [400, 401, 403, 429]) {
    for (const httpStatus of [200, code]) {
      const provider = telegramProvider(settings, async () => Response.json({ ok: false, error_code: code, description: settings.botToken }, { status: httpStatus }));
      const result = await provider.sendText(input);
      assert.deepEqual(result, { status: "rejected", reason: `Telegram rejected message (${code})`, retryable: code === 429 });
      assert.ok(!JSON.stringify(result).includes(settings.botToken));
    }
  }
});

test("timeouts, server failures and malformed or mismatched receipts stay unknown", async () => {
  const responses = [
    new Response("server failure", { status: 503 }), new Response("redirect", { status: 302 }),
    new Response("invalid JSON"), Response.json({ ok: true }), Response.json({ ok: false, error_code: 503 }),
    accepted({ message_id: 0 }), accepted({ message_id: "8" }), accepted({ message_id: Number.MAX_SAFE_INTEGER + 1 }),
    accepted({ chat: { id: 43, type: "private" } }), accepted({ chat: { id: 42, type: "group" } }),
  ];
  for (const response of responses) {
    let calls = 0;
    const provider = telegramProvider(settings, async () => { calls++; return response; });
    assert.equal((await provider.sendText(input)).status, "unknown");
    assert.equal(calls, 1);
  }
  const provider = telegramProvider(settings, async () => { throw new Error(`timeout at /bot${settings.botToken}/sendMessage`); });
  const result = await provider.sendText(input);
  assert.equal(result.status, "unknown");
  assert.ok(!JSON.stringify(result).includes(settings.botToken));
});

test("audio downloads use official getFile and trusted file path with stream checks", async () => {
  let calls = 0;
  const provider = telegramProvider(settings, async (url, init) => {
    calls++;
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    assert.equal(new URL(String(url)).hostname, "api.telegram.org");
    if (calls === 1) {
      assert.equal(String(url), `https://api.telegram.org/bot${settings.botToken}/getFile`);
      assert.deepEqual(JSON.parse(String(init?.body)), { file_id: "file_ABC-123" });
      return metadata();
    }
    assert.equal(String(url), `https://api.telegram.org/file/bot${settings.botToken}/voice/file_1.oga`);
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/ogg; codecs=opus", "content-length": "3" } });
  });
  const media = await provider.downloadAudio(mediaId);
  assert.deepEqual([...media.bytes], [1, 2, 3]);
  assert.equal(media.mimeType, "audio/ogg");
  assert.equal(media.fileName, "voice-note.ogg");
  assert.equal(calls, 2);
});

test("missing inbound MIME uses supported response MIME or file extension", async () => {
  for (const [path, contentType, mimeType, fileName] of [
    ["music/file.m4a", "application/octet-stream", "audio/mp4", "voice-note.m4a"],
    ["voice/file.oga", "", "audio/ogg", "voice-note.ogg"],
    ["file/opaque", "audio/mpeg", "audio/mpeg", "voice-note.mp3"],
  ]) {
    let calls = 0;
    const provider = telegramProvider(settings, async () => ++calls === 1 ? metadata({ file_path: path, file_size: undefined })
      : new Response(new Uint8Array([1, 2, 3]), { headers: contentType ? { "content-type": contentType! } : {} }));
    const media = await provider.downloadAudio(telegramMediaId("file_ABC-123"));
    assert.equal(media.mimeType, mimeType);
    assert.equal(media.fileName, fileName);
  }
});

test("getFile can return a canonical file identity for a retained inbound alias", async () => {
  let calls = 0;
  const provider = telegramProvider(settings, async (url, init) => {
    if (++calls === 1) {
      assert.deepEqual(JSON.parse(String(init?.body)), { file_id: "file_ABC-123" });
      return metadata({ file_id: "file_Canonical-456" });
    }
    assert.equal(String(url), `https://api.telegram.org/file/bot${settings.botToken}/voice/file_1.oga`);
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/ogg" } });
  });
  const audio = await provider.downloadAudio(mediaId);
  assert.deepEqual([...audio.bytes], [1, 2, 3]);
  assert.equal(audio.mimeType, "audio/ogg");
  assert.equal(calls, 2);
});

test("untrusted paths, oversized or malformed metadata never fetch media", async () => {
  for (const file_path of [
    "https://evil.example/audio.ogg", "//evil.example/audio.ogg", "../audio.ogg", "voice/../audio.ogg",
    "voice/%2e%2e/audio.ogg", "voice\\audio.ogg", "/voice/audio.ogg", "voice/audio.ogg?x=1", "voice/audio.ogg#fragment",
  ]) {
    let calls = 0;
    const provider = telegramProvider(settings, async () => { calls++; return metadata({ file_path }); });
    await assert.rejects(provider.downloadAudio(mediaId), /Telegram audio/);
    assert.equal(calls, 1);
  }
  for (const fields of [
    { file_id: "" }, { file_id: undefined }, { file_id: 123 }, { file_id: "x".repeat(513) },
    { file_size: 9 }, { file_size: -1 }, { file_path: "" },
  ]) {
    let calls = 0;
    const provider = telegramProvider(settings, async () => { calls++; return metadata(fields); });
    await assert.rejects(provider.downloadAudio(mediaId), /Telegram audio/);
    assert.equal(calls, 1);
  }
});

test("audio rejects mismatched MIME, bad length, empty or oversized streamed content", async () => {
  for (const response of [
    new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "text/html" } }),
    new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } }),
    new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/ogg", "content-length": "9" } }),
    new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/ogg", "content-length": "invalid" } }),
    new Response(new Uint8Array([1, 2]), { headers: { "content-type": "audio/ogg" } }),
    new Response(new Uint8Array(), { headers: { "content-type": "audio/ogg" } }),
    new Response(new Uint8Array(9), { headers: { "content-type": "audio/ogg", "content-length": "3" } }),
    new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(5)); controller.enqueue(new Uint8Array(5)); controller.close();
    } }), { headers: { "content-type": "application/octet-stream" } }),
    new Response(null, { status: 302 }),
  ]) {
    let calls = 0;
    const provider = telegramProvider(settings, async () => ++calls === 1 ? metadata() : response);
    await assert.rejects(provider.downloadAudio(mediaId), /Telegram audio/);
  }
});

test("all audio transport errors and invalid config omit credentials", async () => {
  for (const failOn of [1, 2]) {
    let calls = 0;
    const provider = telegramProvider(settings, async () => {
      if (++calls === failOn) throw new BadRequestError(`request failed: /bot${settings.botToken}/getFile`);
      return metadata();
    });
    await assert.rejects(provider.downloadAudio(mediaId), (error: Error) => {
      assert.ok(!error.message.includes(settings.botToken));
      assert.equal(error.cause, undefined);
      return /Telegram audio/.test(error.message);
    });
  }
  for (const overrides of [
    { botId: "654321" }, { botToken: `${settings.botToken}/escape` }, { timeoutMs: 0 }, { maxMediaBytes: 0 }, { maxMediaBytes: 21 * 1024 * 1024 },
  ]) assert.throws(() => telegramProvider({ ...settings, ...overrides }), (error: Error) => {
    assert.ok(!error.message.includes(settings.botToken));
    return /configuration/.test(error.message);
  });
});
