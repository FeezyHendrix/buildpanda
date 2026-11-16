import assert from "node:assert/strict";
import { createHmac, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, randomUUID } from "node:crypto";
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
import webhookRoutes from "./webhook-routes.ts";

const databaseUrl = process.env.MESSAGING_AGENT_TEST_DATABASE_URL;
const settings = { ...config.whatsapp, enabled: true, appSecret: "test-webhook-secret", verifyToken: "test-verification-token", phoneNumberId: "123456789" };
const signature = (raw: string) => `sha256=${createHmac("sha256", settings.appSecret).update(raw).digest("hex")}`;
const emptyEnvelope = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

async function webhookApp(options: { enabled?: boolean; db?: Knex; encrypted?: boolean } = {}) {
  const app = Fastify({ logger: false });
  let databaseCalls = 0;
  const deniedDb = Object.assign(() => { throw new Error("Rejected webhook reached the database"); }, {
    transaction: async () => { databaseCalls += 1; throw new Error("Rejected webhook started a transaction"); },
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
    done(null, JSON.parse(emptyEnvelope));
  });
  let observedBody: unknown;
  app.addHook("preHandler", async (request) => { observedBody = request.body; });
  app.post("/ordinary-write", async (request) => request.body);
  await app.register(webhookRoutes, { settings: { ...settings, enabled: options.enabled ?? true } });
  await app.ready();
  return { app, databaseCalls: () => databaseCalls, authCalls: () => authCalls, inheritedParserCalls: () => inheritedParserCalls, body: () => observedBody };
}

test("provider challenge requires enabled integration, subscribe mode and exact verification token", async () => {
  const { app } = await webhookApp();
  try {
    const path = (token: string, mode = "subscribe", challenge = "123456") => `/whatsapp/webhook?${new URLSearchParams({ "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge })}`;
    const verified = await app.inject({ method: "GET", url: path(settings.verifyToken) });
    assert.equal(verified.statusCode, 200);
    assert.equal(verified.body, "123456");
    assert.match(verified.headers["content-type"] ?? "", /^text\/plain/);
    assert.equal((await app.inject({ method: "GET", url: path("wrong-token") })).statusCode, 403);
    assert.equal((await app.inject({ method: "GET", url: path(settings.verifyToken, "unsubscribe") })).statusCode, 400);
    assert.equal((await app.inject({ method: "GET", url: path(settings.verifyToken, "subscribe", "<script>") })).statusCode, 400);
    assert.equal((await app.inject({ method: "GET", url: "/whatsapp/webhook" })).statusCode, 400);
  } finally { await app.close(); }
  const disabled = await webhookApp({ enabled: false });
  try {
    const response = await disabled.app.inject({ method: "GET", url: `/whatsapp/webhook?${new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": settings.verifyToken, "hub.challenge": "1" })}` });
    assert.equal(response.statusCode, 404);
  } finally { await disabled.app.close(); }
});

test("missing, invalid and differently serialized signatures fail before JSON parsing or persistence", async () => {
  const { app, databaseCalls } = await webhookApp();
  try {
    for (const raw of [emptyEnvelope, "{ malformed JSON"]) {
      for (const supplied of [undefined, "sha256=bad", `sha256=${"0".repeat(64)}`]) {
        const response = await app.inject({ method: "POST", url: "/whatsapp/webhook", payload: raw,
          headers: { "content-type": "application/json", ...(supplied ? { "x-hub-signature-256": supplied } : {}) } });
        assert.equal(response.statusCode, 403, response.body);
      }
    }
    const raw = `  ${emptyEnvelope}\n`;
    const response = await app.inject({ method: "POST", url: "/whatsapp/webhook", payload: raw,
      headers: { "content-type": "application/json", "x-hub-signature-256": signature(emptyEnvelope) } });
    assert.equal(response.statusCode, 403);
    assert.equal(databaseCalls(), 0);
  } finally { await app.close(); }
});

test("signed malformed JSON, invalid envelopes, wrong business numbers and disabled intake never persist", async () => {
  const { app, databaseCalls } = await webhookApp();
  try {
    for (const raw of ["{ malformed JSON", "{}", JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "other-number" }, messages: [] } }] }] })]) {
      const response = await app.inject({ method: "POST", url: "/whatsapp/webhook", payload: raw,
        headers: { "content-type": "application/json", "x-hub-signature-256": signature(raw) } });
      assert.equal(response.statusCode, 400, response.body);
    }
    assert.equal(databaseCalls(), 0);
  } finally { await app.close(); }
  const disabled = await webhookApp({ enabled: false });
  try {
    const response = await disabled.app.inject({ method: "POST", url: "/whatsapp/webhook", payload: emptyEnvelope,
      headers: { "content-type": "application/json", "x-hub-signature-256": signature(emptyEnvelope) } });
    assert.equal(response.statusCode, 404);
    assert.equal(disabled.databaseCalls(), 0);
  } finally { await disabled.app.close(); }
});

test("public API payload encryption and inherited parsers cannot bypass provider signatures", async () => {
  const previousKey = config.http.payloadKey;
  Object.assign(config.http, { payloadKey: generateServerSecret() });
  let fixture: Awaited<ReturnType<typeof webhookApp>> | undefined;
  try {
    fixture = await webhookApp({ encrypted: true });
    const { app } = fixture;
    const published = await app.inject({ method: "GET", url: "/crypto/payload-key" });
    assert.equal(published.statusCode, 200);
    // An unauthenticated client needs only the published public key to encrypt API requests.
    const client = generateKeyPairSync("x25519");
    const clientPublicKey = client.publicKey.export({ format: "jwk" }).x!;
    const serverPublicKey = createPublicKey({ key: { kty: "OKP", crv: "X25519", x: published.json().publicKey }, format: "jwk" });
    const shared = diffieHellman({ privateKey: client.privateKey, publicKey: serverPublicKey });
    const key = Buffer.from(hkdfSync("sha256", shared, Buffer.from(clientPublicKey, "base64url"), Buffer.from("buildpanda-payload-v1"), 32));
    const payload = JSON.stringify(seal(key, emptyEnvelope, "request"));
    const headers = { "content-type": ENCRYPTED_CONTENT_TYPE, [KEY_HEADER]: clientPublicKey };
    const ordinary = await app.inject({ method: "POST", url: "/ordinary-write", headers, payload });
    assert.equal(ordinary.statusCode, 200);
    assert.equal(open(key, ordinary.json(), "response"), emptyEnvelope);
    const encrypted = await app.inject({ method: "POST", url: "/whatsapp/webhook", headers, payload });
    assert.equal(encrypted.statusCode, 415);
    assert.equal(JSON.parse(open(key, encrypted.json(), "response")).code, "unsupported_media_type");
    const alternate = await app.inject({ method: "POST", url: "/whatsapp/webhook", payload: emptyEnvelope,
      headers: { "content-type": "application/x-test-provider" } });
    assert.equal(alternate.statusCode, 415);
    assert.equal(fixture.inheritedParserCalls(), 0);
    assert.equal(fixture.databaseCalls(), 0);
  } finally {
    await fixture?.app.close();
    Object.assign(config.http, { payloadKey: previousKey });
  }
});

test("signed original bytes survive global sanitation and persist one inbox row under provider replay", { skip: !databaseUrl }, async () => {
  const db = knex({ client: "pg", connection: databaseUrl });
  const providerMessageId = `webhook-test-${randomUUID()}`;
  const html = "<p onclick=\"alert(1)\">Site &amp; voice /files/provider-reference/download</p><script>ignore()</script>";
  const envelope = { object: "whatsapp_business_account", auditHtml: html, entry: [{ changes: [{ field: "messages", value: {
    metadata: { phone_number_id: settings.phoneNumberId }, messages: [{ id: providerMessageId, from: `sender-${randomUUID()}`, timestamp: "1794657600", type: "text", text: { body: html } }],
  } }] }] };
  const raw = ` \n${JSON.stringify(envelope, null, 2)}\n`;
  const { app, body, authCalls } = await webhookApp({ db });
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await app.inject({ method: "POST", url: "/whatsapp/webhook?provider=meta", payload: raw,
        headers: { "content-type": "application/json; charset=utf-8", "x-hub-signature-256": signature(raw) } });
      assert.equal(response.statusCode, 200, response.body);
      assert.deepEqual(response.json(), { received: true });
      assert.deepEqual(body(), envelope);
    }
    const rows = await db("messaging_agent_inbox").where({ provider_message_id: providerMessageId });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].source_text, html);
    assert.equal(rows[0].channel, "whatsapp");
    assert.equal(rows[0].channel_account_id, settings.phoneNumberId);
    assert.equal(rows[0].conversation_type, "direct");
    assert.equal(rows[0].reply_recipient_id, envelope.entry[0]!.changes[0]!.value.messages[0]!.from);
    assert.equal(authCalls(), 0);
    const ordinary = await app.inject({ method: "POST", url: "/ordinary-write", payload: { auditHtml: "<p onclick=\"alert(1)\">Site &amp; voice</p><script>ignore()</script>" } });
    assert.equal(ordinary.statusCode, 200);
    assert.equal(ordinary.json().auditHtml, "<p>Site &amp; voice</p>");
    const protectedWrite = await app.inject({ method: "POST", url: "/ordinary-write", payload: { bodyText: "/files/provider-reference/download" } });
    assert.equal(protectedWrite.statusCode, 401);
    assert.equal(authCalls(), 1);
  } finally {
    await app.close();
    await db("messaging_agent_inbox").where({ provider_message_id: providerMessageId }).del();
    await db.destroy();
  }
});
