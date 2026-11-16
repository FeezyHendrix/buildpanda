import assert from "node:assert/strict";
import { test } from "node:test";
import { configureTelegramWebhook } from "./telegram-webhook.ts";

const env = {
  TELEGRAM_BOT_TOKEN: "10001:unit_test_credential_only_1234567890",
  TELEGRAM_BOT_ID: "10001", TELEGRAM_BOT_USERNAME: "buildpanda_bot",
  TELEGRAM_WEBHOOK_SECRET: "unit_test_webhook_secret_1234567890", PUBLIC_API_URL: "https://api.example.test",
};
const identity = { id: 10001, is_bot: true, username: "buildpanda_bot" };
const webhook = { url: "https://api.example.test/telegram/webhook", allowed_updates: ["message"], pending_update_count: 0 };

test("check verifies the bot and inspects the webhook without registering it", async () => {
  const calls: string[] = [];
  const result = await configureTelegramWebhook(env, false, async (input, init) => {
    const method = String(input).split("/").at(-1)!;
    calls.push(method);
    assert.equal(init?.redirect, "error");
    return Response.json({ ok: true, result: method === "getMe" ? identity : webhook });
  });
  assert.deepEqual(calls, ["getMe", "getWebhookInfo"]);
  assert.deepEqual(result, { registered: false, webhookMatches: true, pendingUpdates: 0, hasRecordedDeliveryError: false });
});

test("registration verifies identity before setting a secret-protected message-only webhook and preserves pending updates", async () => {
  const calls: string[] = [];
  const result = await configureTelegramWebhook(env, true, async (input, init) => {
    const method = String(input).split("/").at(-1)!;
    calls.push(method);
    if (method === "setWebhook") assert.deepEqual(JSON.parse(String(init?.body)), {
      url: webhook.url, secret_token: env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ["message"], drop_pending_updates: false,
    });
    return Response.json({ ok: true, result: method === "getMe" ? identity : method === "setWebhook" ? true : webhook });
  });
  assert.deepEqual(calls, ["getMe", "setWebhook", "getWebhookInfo"]);
  assert.equal(result.registered, true);
});

test("an unexpected bot identity never reaches setWebhook", async () => {
  for (const wrongIdentity of [{ ...identity, id: 10002 }, { ...identity, username: "another_bot" }, { ...identity, is_bot: false }]) {
    const calls: string[] = [];
    await assert.rejects(configureTelegramWebhook(env, true, async (input) => {
      calls.push(String(input).split("/").at(-1)!);
      return Response.json({ ok: true, result: wrongIdentity });
    }), /identity does not match/);
    assert.deepEqual(calls, ["getMe"]);
  }
});

test("invalid credentials and webhook origins fail before any network request", async () => {
  for (const invalid of [
    { TELEGRAM_BOT_TOKEN: "" }, { TELEGRAM_BOT_ID: "10002" }, { TELEGRAM_BOT_ID: "9007199254740992" },
    { TELEGRAM_BOT_USERNAME: "@buildpanda_bot" }, { TELEGRAM_WEBHOOK_SECRET: "has spaces" }, { TELEGRAM_WEBHOOK_SECRET: "a".repeat(31) },
    { PUBLIC_API_URL: "http://api.example.test" }, { PUBLIC_API_URL: "https://api.example.test/path" },
    { PUBLIC_API_URL: "https://user:password@api.example.test" }, { PUBLIC_API_URL: "https://api.example.test?query" },
    { PUBLIC_API_URL: "https://api.example.test:3000" }, { PUBLIC_API_URL: "invalid" },
  ]) {
    let requests = 0;
    await assert.rejects(configureTelegramWebhook({ ...env, ...invalid }, true, async () => {
      requests++;
      throw new Error("unexpected request");
    }));
    assert.equal(requests, 0);
  }
});

test("provider and transport failures never include credentials or response bodies in errors", async () => {
  for (const fetcher of [
    async () => { throw new Error(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`); },
    async () => Response.json({ ok: false, description: env.TELEGRAM_BOT_TOKEN }, { status: 401 }),
    async () => Response.json({ ok: false, description: env.TELEGRAM_BOT_TOKEN }),
    async () => new Response("not JSON"),
  ]) {
    await assert.rejects(configureTelegramWebhook(env, true, fetcher), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "Telegram getMe failed; transport details and response omitted");
      assert.ok(!error.message.includes(env.TELEGRAM_BOT_TOKEN));
      return true;
    });
  }
});

test("check reports a wrong callback, wrong update subscription and historical delivery errors without response details", async () => {
  for (const wrongWebhook of [
    { ...webhook, url: "https://other.example.test/telegram/webhook" },
    { ...webhook, allowed_updates: ["message", "callback_query"] },
    { ...webhook, allowed_updates: undefined },
  ]) {
    const result = await configureTelegramWebhook(env, false, async (input) => Response.json({
      ok: true, result: String(input).endsWith("/getMe") ? identity : {
        ...wrongWebhook, pending_update_count: 2, last_error_date: 1, last_error_message: env.TELEGRAM_BOT_TOKEN,
      },
    }));
    assert.deepEqual(result, { registered: false, webhookMatches: false, pendingUpdates: 2, hasRecordedDeliveryError: true });
  }
});
