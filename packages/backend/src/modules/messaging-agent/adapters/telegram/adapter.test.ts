import assert from "node:assert/strict";
import { test } from "node:test";
import { telegramChannelAdapter } from "./adapter.ts";
import { telegramMessageId, telegramSenderId } from "./identifiers.ts";
import type { MessagingSendInput } from "../../types.ts";

const settings = {
  enabled: true, botId: "123456", botToken: "123456:fake_token_for_injected_fetch_only",
  botUsername: "buildpanda_bot", webhookSecret: "fixture-secret",
};

test("Telegram linking opens the configured bot with the original private start payload", () => {
  const code = "a_B-c0123456789_abcdefghijklmnop";
  for (const botUsername of ["buildpanda_bot", "@buildpanda_bot"]) {
    const adapter = telegramChannelAdapter({ ...settings, botUsername });
    const link = new URL(adapter.connectUrl(code)!);
    assert.equal(link.origin, "https://t.me");
    assert.equal(link.pathname, "/buildpanda_bot");
    assert.equal(link.searchParams.get("start"), code);
    assert.equal([...link.searchParams].length, 1);
    assert.equal(adapter.channel, "telegram");
    assert.equal(adapter.channelAccountId, settings.botId);
    assert.equal(adapter.label, "Telegram");
    assert.equal(adapter.maxTextLength, 4096);
  }
});

test("Telegram can reply to established private chats beyond WhatsApp's 24 hour window", () => {
  const adapter = telegramChannelAdapter(settings), now = new Date("2026-11-16T12:00:00Z");
  for (const inbound of [
    new Date("2025-01-01T00:00:00Z"), "2026-11-15T12:00:00Z", new Date(now),
    new Date(now.getTime() + 5 * 60_000),
  ]) assert.equal(adapter.canReply(inbound, now), true);
  for (const inbound of [null, "", "invalid", new Date(NaN), new Date(now.getTime() + 5 * 60_000 + 1)]) {
    assert.equal(adapter.canReply(inbound, now), false);
  }
  assert.equal(adapter.canReply(now, new Date(NaN)), false);
});

test("Telegram adapter delegates send and audio download without changing channel identities", async () => {
  const input = { to: telegramSenderId(42, 42), text: "Saved", replyToMessageId: telegramMessageId(42, 1) };
  const media = { bytes: new Uint8Array([1, 2, 3]), mimeType: "audio/ogg", fileName: "voice-note.ogg" };
  const provider = {
    async sendText(received: MessagingSendInput) {
      assert.strictEqual(received, input);
      return { status: "accepted" as const, messageId: telegramMessageId(42, 2) };
    },
    async downloadAudio(mediaId: string) {
      assert.equal(mediaId, "tg:ogg:fixture_file");
      return media;
    },
  };
  const adapter = telegramChannelAdapter(settings, provider);
  assert.deepEqual(await adapter.sendText(input), { status: "accepted", messageId: telegramMessageId(42, 2) });
  assert.strictEqual(await adapter.downloadAudio("tg:ogg:fixture_file"), media);
});
