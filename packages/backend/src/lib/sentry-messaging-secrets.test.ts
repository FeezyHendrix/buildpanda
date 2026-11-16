import assert from "node:assert/strict";
import { channel } from "node:diagnostics_channel";
import { test } from "node:test";
import * as Sentry from "@sentry/node";
import { isTelegramApiRequest, stripMessagingWebhookSecret } from "./sentry-messaging-secrets.ts";

test("Telegram API detection checks the exact host without requiring credentials", () => {
  for (const url of [
    "https://api.telegram.org/bot123456:fake_token/sendMessage",
    "https://api.telegram.org/file/bot123456:fake_token/voice/file.oga",
    "https://API.TELEGRAM.ORG/getMe",
  ]) assert.equal(isTelegramApiRequest(url), true);
  for (const url of [
    "https://api.telegram.org.example.test/bot123456:fake_token/sendMessage",
    "https://api.telegram.org@example.test/path", "https://graph.facebook.com/v27.0/messages", "invalid URL",
  ]) assert.equal(isTelegramApiRequest(url), false);
});

test("Sentry envelopes omit webhook secrets and Telegram fetch telemetry while retaining other requests", async () => {
  const envelopes: Parameters<Sentry.NodeClient["sendEnvelope"]>[0][] = [];
  const secret = "fake-webhook-secret-for-envelope-only", token = "123456:fake_bot_token_for_envelope_only";
  const telegramCode = "fake-telegram-link-code-never-export", whatsappCode = "fake-whatsapp-link-code-never-export";
  const client = Sentry.init({
    dsn: "https://fake@example.invalid/1", defaultIntegrations: false, tracesSampleRate: 1,
    integrations: [Sentry.requestDataIntegration(), Sentry.nativeNodeFetchIntegration({ ignoreOutgoingRequests: isTelegramApiRequest })],
    beforeSend: stripMessagingWebhookSecret, beforeSendTransaction: stripMessagingWebhookSecret,
    transport: () => ({ send: async (envelope) => { envelopes.push(envelope); return { statusCode: 200 }; }, flush: async () => true }),
  });
  assert.ok(client);
  try {
    await Sentry.withIsolationScope(async (scope) => {
      scope.setSDKProcessingMetadata({ normalizedRequest: { method: "POST", url: "https://api.example.test/telegram/webhook", data: JSON.stringify({ message: { text: `/start ${telegramCode}` } }), headers: {
        "x-telegram-bot-api-secret-token": secret, "X-Telegram-Bot-Api-Secret-Token": secret, "x-fixture-id": "retained-header",
      } } });
      await Sentry.startSpan({ name: "Messaging webhook", op: "http.server", forceTransaction: true }, async () => {
        // Publishing the native fetch diagnostic messages exercises Sentry's real integrations without network traffic.
        for (const url of [
          `https://api.telegram.org/bot${token}/sendMessage`,
          `https://api.telegram.org/file/bot${token}/voice/file.oga`,
          "https://example.test/ordinary-request",
        ]) {
          const parsed = new URL(url), request = { origin: parsed.origin, path: parsed.pathname, method: "POST", headers: "" };
          channel("undici:request:create").publish({ request });
          channel("undici:request:headers").publish({ request, response: { statusCode: 200, headers: [] } });
          channel("undici:request:trailers").publish({ request, trailers: [] });
        }
        Sentry.captureException(new Error("Fixture persistence failure"));
      });
    });
    for (const [url, data] of [
      ["https://api.example.test/whatsapp/webhook?provider=meta", { messages: [{ text: { body: `LINK ${whatsappCode}` } }] }],
      ["https://api.example.test/projects/fixture", { bodyText: "Ordinary API body retained" }],
    ] as const) {
      await Sentry.withIsolationScope(async (scope) => {
        scope.setSDKProcessingMetadata({ normalizedRequest: { method: "POST", url, data, headers: {} } });
        await Sentry.startSpan({ name: "Request fixture", op: "http.server", forceTransaction: true }, async () => {
          Sentry.captureException(new Error("Fixture request failure"));
        });
      });
    }
    await Sentry.flush(2000);
    const contents = JSON.stringify(envelopes);
    assert.ok(envelopes.length >= 2, "Expected both error and transaction envelopes");
    assert.ok(!contents.includes(secret), "Webhook secret leaked into a Sentry envelope");
    assert.ok(!contents.includes(token), "Bot token leaked into a Sentry envelope");
    assert.ok(!contents.includes(telegramCode), "Telegram linking payload leaked into a Sentry envelope");
    assert.ok(!contents.includes(whatsappCode), "WhatsApp linking payload leaked into a Sentry envelope");
    assert.ok(contents.includes("Ordinary API body retained"), "Unrelated request data was removed");
    assert.ok(!contents.includes("api.telegram.org"), "Telegram fetch telemetry was captured");
    assert.ok(contents.includes("retained-header"), "Unrelated inbound header was removed");
    const error = envelopes.find(([, items]) => items.some(([header]) => header.type === "event"));
    const transaction = envelopes.find(([, items]) => items.some(([header]) => header.type === "transaction"));
    assert.ok(error);
    assert.ok(transaction);
    assert.ok(JSON.stringify(error).includes("https://example.test/ordinary-request"), "Unrelated fetch breadcrumb was removed");
    assert.ok(JSON.stringify(transaction).includes("https://example.test/ordinary-request"), "Unrelated fetch span was removed");
  } finally {
    await Sentry.close(2000);
  }
});
