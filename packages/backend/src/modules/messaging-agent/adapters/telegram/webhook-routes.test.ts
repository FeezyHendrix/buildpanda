import assert from "node:assert/strict";
import { createHash, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, randomInt } from "node:crypto";
import { test } from "node:test";
import Fastify from "fastify";
import fp from "fastify-plugin";
import knex, { type Knex } from "knex";
import { config } from "../../../../config/index.ts";
import { UnauthorizedError } from "../../../../lib/errors.ts";
import { ENCRYPTED_CONTENT_TYPE, generateServerSecret, KEY_HEADER, open, seal } from "../../../../lib/payload-crypto.ts";
import errorHandler from "../../../../plugins/error-handler.ts";
import fileReferenceAccess from "../../../../plugins/file-reference-access.ts";
import payloadEncryption from "../../../../plugins/payload-encryption.ts";
import security from "../../../../plugins/security.ts";
import { telegramCallbackMessageId, telegramMessageId, telegramSenderId } from "./identifiers.ts";
import webhookRoutes from "./webhook-routes.ts";

const databaseUrl = process.env.MESSAGING_AGENT_TEST_DATABASE_URL;
const settings = { enabled: true, botToken: "123456:never-log-this-test-token", botId: "123456", botUsername: "buildpanda_bot", webhookSecret: "test-webhook-secret" };
const secretHeader = { "x-telegram-bot-api-secret-token": settings.webhookSecret };
const headers = { "content-type": "application/json", ...secretHeader };
const irrelevantUpdate = JSON.stringify({ update_id: 1 });

async function webhookApp(options: { enabled?: boolean; db?: Knex; encrypted?: boolean; answerCallbackQuery?: (id: string) => Promise<void> } = {}) {
  const app = Fastify({ logger: false });
  let databaseCalls = 0;
  const deniedDb = Object.assign(() => { throw new Error("Webhook reached a database query without a real fixture"); }, {
    transaction: async (operation: (db: never) => Promise<unknown>) => { databaseCalls += 1; return operation(deniedDb as never); },
  });
  app.decorate("db", options.db ?? deniedDb as never);
  await app.register(errorHandler);
  await app.register(security);
  if (options.encrypted) await app.register(payloadEncryption);
  let authCalls = 0;
  await app.register(fp(async (fastify) => {
    fastify.decorateRequest("requireAuth", () => { authCalls += 1; throw new UnauthorizedError(); });
  }, { name: "auth-context" }));
  await app.register(fileReferenceAccess);
  let inheritedParserCalls = 0;
  app.addContentTypeParser("application/x-test-provider", (_request, _body, done) => {
    inheritedParserCalls += 1;
    done(null, { update_id: 1 });
  });
  let observedBody: unknown;
  app.addHook("preHandler", async (request) => { observedBody = request.body; });
  app.post("/ordinary-write", async (request) => request.body);
  await app.register(webhookRoutes, { settings: { ...settings, enabled: options.enabled ?? true }, answerCallbackQuery: options.answerCallbackQuery });
  await app.ready();
  return { app, databaseCalls: () => databaseCalls, authCalls: () => authCalls, inheritedParserCalls: () => inheritedParserCalls, body: () => observedBody };
}

test("Telegram secret verification precedes JSON parsing and persistence", async () => {
  const { app, databaseCalls } = await webhookApp();
  try {
    for (const payload of [irrelevantUpdate, "{ malformed JSON"]) {
      for (const supplied of [undefined, "wrong", "x".repeat(settings.webhookSecret.length), [settings.webhookSecret, "wrong"]]) {
        const response = await app.inject({ method: "POST", url: "/telegram/webhook", payload,
          headers: { "content-type": "application/json", ...(supplied ? { "x-telegram-bot-api-secret-token": supplied } : {}) } });
        assert.equal(response.statusCode, 403, response.body);
        assert.ok(!response.body.includes(settings.webhookSecret));
      }
    }
    assert.equal(databaseCalls(), 0);
    for (const payload of ["{ malformed JSON", "{}", JSON.stringify({ update_id: 1, message: {} })]) {
      const response = await app.inject({ method: "POST", url: "/telegram/webhook", headers, payload });
      assert.equal(response.statusCode, 400, response.body);
    }
    assert.equal(databaseCalls(), 0);
    const accepted = await app.inject({ method: "POST", url: "/telegram/webhook", headers, payload: irrelevantUpdate });
    assert.equal(accepted.statusCode, 200, accepted.body);
    assert.deepEqual(accepted.json(), { received: true });
    assert.equal(databaseCalls(), 1);
    const failedPersistence = await app.inject({ method: "POST", url: "/telegram/webhook", headers,
      payload: { update_id: 2, message: { message_id: 1, date: 1794657600, chat: { id: 701, type: "private" }, from: { id: 701, is_bot: false }, text: "Site update" } } });
    assert.equal(failedPersistence.statusCode, 500, failedPersistence.body);
  } finally { await app.close(); }
});

function reviewCallback(chatId: number, id = "press-1", data = "CONFIRM proposal_1 1") {
  return { update_id: chatId, callback_query: {
    id, data, from: { id: chatId, is_bot: false },
    message: { message_id: 11, date: 1794657600, from: { id: Number(settings.botId), is_bot: true }, chat: { id: chatId, type: "private" } },
  } };
}

test("unverified, ignored and failed callback intake never acknowledges acceptance", async () => {
  let acknowledgements = 0;
  const fixture = await webhookApp({ answerCallbackQuery: async () => { acknowledgements++; } });
  try {
    const callback = reviewCallback(701);
    const unverified = await fixture.app.inject({ method: "POST", url: "/telegram/webhook", payload: callback, headers: { ...headers, ...{ "x-telegram-bot-api-secret-token": "wrong" } } });
    assert.equal(unverified.statusCode, 403);
    const ignored = await fixture.app.inject({ method: "POST", url: "/telegram/webhook", payload: reviewCallback(701, "ignored", "STOP"), headers });
    assert.equal(ignored.statusCode, 200);
    const failed = await fixture.app.inject({ method: "POST", url: "/telegram/webhook", payload: callback, headers });
    assert.equal(failed.statusCode, 500);
    assert.equal(acknowledgements, 0);
  } finally { await fixture.app.close(); }
});

test("callback intake commits before acknowledging and replays cannot duplicate the command", { skip: !databaseUrl }, async () => {
  const db = knex({ client: "pg", connection: databaseUrl });
  const chatId = randomInt(1_000_000_000, 2_000_000_000), acknowledged: string[] = [];
  let failAcknowledgement = false;
  const fixture = await webhookApp({ db, answerCallbackQuery: async (id) => {
    const row = await db("messaging_agent_inbox").where({ channel: "telegram", channel_account_id: settings.botId, provider_message_id: telegramCallbackMessageId(chatId, 11, id) }).first();
    assert.ok(row, "The independent connection must observe the committed command before acknowledgement");
    acknowledged.push(id);
    if (failAcknowledgement) throw new Error("Simulated Telegram acknowledgement failure");
  } });
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fixture.app.inject({ method: "POST", url: "/telegram/webhook", payload: reviewCallback(chatId), headers });
      assert.equal(response.statusCode, 200, response.body);
    }
    failAcknowledgement = true;
    const second = await fixture.app.inject({ method: "POST", url: "/telegram/webhook", payload: reviewCallback(chatId, "press-2", "CANCEL proposal_1 1"), headers });
    assert.equal(second.statusCode, 200, second.body);
    const rows = await db("messaging_agent_inbox").where({ channel: "telegram", channel_account_id: settings.botId, sender_id: telegramSenderId(chatId, chatId) }).orderBy("source_text");
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((row) => row.source_text), ["CANCEL proposal_1 1", "CONFIRM proposal_1 1"]);
    assert.ok(rows.every((row) => new Date(row.sent_at).getTime() > 1794657600 * 1000));
    assert.deepEqual(acknowledged, ["press-1", "press-1", "press-2"]);
  } finally {
    await fixture.app.close();
    await db("messaging_agent_inbox").where({ channel: "telegram", channel_account_id: settings.botId, sender_id: telegramSenderId(chatId, chatId) }).del();
    await db.destroy();
  }
});

test("disabled Telegram intake is unavailable before parsing, even with missing headers", async () => {
  const { app, databaseCalls } = await webhookApp({ enabled: false });
  try {
    for (const requestHeaders of [headers, { "content-type": "text/plain" }, {}]) {
      const response = await app.inject({ method: "POST", url: "/telegram/webhook", headers: requestHeaders, payload: "{ malformed" });
      assert.equal(response.statusCode, 404, response.body);
    }
    assert.equal(databaseCalls(), 0);
  } finally { await app.close(); }
});

test("only JSON can enter Telegram intake, and its parser is scoped to its routes", async () => {
  const fixture = await webhookApp();
  try {
    for (const type of ["text/plain", "application/x-test-provider", "application/json-patch+json"]) {
      const response = await fixture.app.inject({ method: "POST", url: "/telegram/webhook", payload: irrelevantUpdate, headers: { "content-type": type, ...secretHeader } });
      assert.equal(response.statusCode, 415, response.body);
    }
    assert.equal(fixture.inheritedParserCalls(), 0);
    assert.equal(fixture.databaseCalls(), 0);
    const ordinary = await fixture.app.inject({ method: "POST", url: "/ordinary-write", payload: { auditHtml: "<p onclick=\"run()\">Site</p><script>ignore()</script>" } });
    assert.equal(ordinary.statusCode, 200, ordinary.body);
    assert.equal(ordinary.json().auditHtml, "<p>Site</p>");
    const otherProvider = await fixture.app.inject({ method: "POST", url: "/ordinary-write", payload: irrelevantUpdate, headers: { "content-type": "application/x-test-provider" } });
    assert.equal(otherProvider.statusCode, 200, otherProvider.body);
    assert.equal(fixture.inheritedParserCalls(), 1);
    const protectedWrite = await fixture.app.inject({ method: "POST", url: "/ordinary-write", payload: { bodyText: "/files/provider-reference/download" } });
    assert.equal(protectedWrite.statusCode, 401);
    assert.equal(fixture.authCalls(), 1);
  } finally { await fixture.app.close(); }
});

test("public payload encryption cannot bypass Telegram's JSON parser and secret verification", async () => {
  const previousKey = config.http.payloadKey;
  Object.assign(config.http, { payloadKey: generateServerSecret() });
  let fixture: Awaited<ReturnType<typeof webhookApp>> | undefined;
  try {
    fixture = await webhookApp({ encrypted: true });
    const published = await fixture.app.inject({ method: "GET", url: "/crypto/payload-key" });
    assert.equal(published.statusCode, 200);
    const client = generateKeyPairSync("x25519"), clientPublicKey = client.publicKey.export({ format: "jwk" }).x!;
    const serverPublicKey = createPublicKey({ key: { kty: "OKP", crv: "X25519", x: published.json().publicKey }, format: "jwk" });
    const shared = diffieHellman({ privateKey: client.privateKey, publicKey: serverPublicKey });
    const key = Buffer.from(hkdfSync("sha256", shared, Buffer.from(clientPublicKey, "base64url"), Buffer.from("buildpanda-payload-v1"), 32));
    const payload = JSON.stringify(seal(key, irrelevantUpdate, "request"));
    const encryptedHeaders = { "content-type": ENCRYPTED_CONTENT_TYPE, [KEY_HEADER]: clientPublicKey, ...secretHeader };
    const ordinary = await fixture.app.inject({ method: "POST", url: "/ordinary-write", headers: encryptedHeaders, payload });
    assert.equal(ordinary.statusCode, 200);
    assert.equal(open(key, ordinary.json(), "response"), irrelevantUpdate);
    const encrypted = await fixture.app.inject({ method: "POST", url: "/telegram/webhook", headers: encryptedHeaders, payload });
    assert.equal(encrypted.statusCode, 415);
    assert.equal(JSON.parse(open(key, encrypted.json(), "response")).code, "unsupported_media_type");
    const plainWithoutSecret = await fixture.app.inject({ method: "POST", url: "/telegram/webhook", headers: { "content-type": "application/json", [KEY_HEADER]: clientPublicKey }, payload: irrelevantUpdate });
    assert.equal(plainWithoutSecret.statusCode, 403);
    assert.equal(fixture.databaseCalls(), 0);
  } finally {
    await fixture?.app.close();
    Object.assign(config.http, { payloadKey: previousKey });
  }
});

test("verified Telegram updates durably retain text/voice and redact linking codes once under replay", { skip: !databaseUrl }, async () => {
  const db = knex({ client: "pg", connection: databaseUrl });
  const chatId = randomInt(1_000_000_000, 2_000_000_000), code = "c".repeat(32);
  const base = { date: 1794657600, from: { id: chatId, is_bot: false }, chat: { id: chatId, type: "private" } };
  const html = "<p onclick=\"run()\">Site &amp; voice /files/provider-reference/download</p><script>ignore()</script>";
  const updates = [
    { update_id: chatId, message: { ...base, message_id: 1, text: html } },
    { update_id: chatId + 1, message: { ...base, message_id: 2, voice: { file_id: "Voice_File-123", mime_type: "audio/ogg", duration: 3 } } },
    { update_id: chatId + 2, message: { ...base, message_id: 3, text: `/start ${code}` } },
  ];
  const fixture = await webhookApp({ db });
  try {
    for (const update of updates) for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fixture.app.inject({ method: "POST", url: "/telegram/webhook?provider=telegram", payload: ` \n${JSON.stringify(update, null, 2)}\n`,
        headers: { ...headers, "content-type": "application/json; charset=utf-8" } });
      assert.equal(response.statusCode, 200, response.body);
      assert.deepEqual(response.json(), { received: true });
      assert.deepEqual(fixture.body(), update);
    }
    const rows = await db("messaging_agent_inbox").where({ channel: "telegram", channel_account_id: settings.botId, sender_id: telegramSenderId(chatId, chatId) }).orderBy("provider_message_id");
    assert.equal(rows.length, 3);
    assert.equal(rows[0].provider_message_id, telegramMessageId(chatId, 1));
    assert.equal(rows[0].source_text, html);
    assert.equal(rows[0].reply_recipient_id, telegramSenderId(chatId, chatId));
    assert.equal(rows[0].conversation_type, "direct");
    assert.equal(rows[1].source_kind, "voice_translation");
    assert.equal(rows[1].media_id, "tg:ogg:Voice_File-123");
    assert.equal(rows[2].source_text, "LINK [code redacted]");
    assert.equal(rows[2].link_code_hash, createHash("sha256").update(code).digest("hex"));
    assert.equal(fixture.authCalls(), 0);
  } finally {
    await fixture.app.close();
    await db("messaging_agent_inbox").where({ channel: "telegram", channel_account_id: settings.botId, sender_id: telegramSenderId(chatId, chatId) }).del();
    await db.destroy();
  }
});
