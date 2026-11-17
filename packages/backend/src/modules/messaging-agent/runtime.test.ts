import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { test } from "node:test";
import { hashPassword } from "better-auth/crypto";

const databaseUrl = process.env.MESSAGING_AGENT_TEST_DATABASE_URL;
const redisUrl = process.env.MESSAGING_AGENT_TEST_REDIS_URL;

test("the full backend authenticates, links, drafts from its signed webhook and commits through the real review route", { skip: !databaseUrl || !redisUrl }, async () => {
  const database = new URL(databaseUrl!);
  Object.assign(process.env, {
    NODE_ENV: "test", DB_HOST: database.hostname, DB_PORT: database.port || "5432",
    DB_NAME: database.pathname.slice(1), DB_USER: decodeURIComponent(database.username), DB_PASSWORD: decodeURIComponent(database.password),
    REDIS_URL: redisUrl!, RUN_WORKERS: "false", RATE_LIMIT_ENABLED: "false", LOG_LEVEL: "error",
    BETTER_AUTH_SECRET: "panda-messagingAgent-runtime-test-secret-only-32-characters", BETTER_AUTH_URL: "http://localhost:3000",
    SENDBYTE_API_KEY: "", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", API_PAYLOAD_KEY: "",
    WHATSAPP_ENABLED: "true", WHATSAPP_VERIFY_TOKEN: "runtime-test", WHATSAPP_APP_SECRET: "runtime-test",
    WHATSAPP_ACCESS_TOKEN: "never-sent", WHATSAPP_PHONE_NUMBER_ID: "155555511111", WHATSAPP_BUSINESS_NUMBER: "+15555551111", WHATSAPP_API_VERSION: "v25.0",
  });
  const { buildApp } = await import("../../server.ts");
  const { messagingAgentWorker } = await import("./worker.ts");
  const { messagingAdapterRegistry } = await import("./channels.ts");
  const { whatsappChannelAdapter } = await import("./adapters/whatsapp/adapter.ts");
  const { config } = await import("../../config/index.ts");
  const app = await buildApp();
  const suffix = randomUUID();
  const userId = `wa-runtime-${suffix}`, organizationId = `wa-runtime-org-${suffix}`;
  const projectId = `wa-runtime-project-${suffix}`, buildingId = `wa-runtime-building-${suffix}`;
  const senderId = `US.${suffix}`, email = `${userId}@agent.invalid`, password = "Local-fixture-password-93";
  const phoneNumberId = "155555511111";
  let cookie = "";
  try {
    await app.ready();
    for (const [method, url] of [
      ["GET", "/messaging-agent/status"], ["POST", "/messaging-agent/link"], ["DELETE", "/messaging-agent/connections/:connectionId"],
      ["GET", "/messaging-agent/projects/:projectId/session"], ["PATCH", "/messaging-agent/projects/:projectId/scope"],
      ["POST", "/messaging-agent/projects/:projectId/proposals"], ["PATCH", "/messaging-agent/projects/:projectId/proposals/:proposalId"],
      ["POST", "/messaging-agent/projects/:projectId/proposals/:proposalId/confirm"],
      ["POST", "/messaging-agent/projects/:projectId/proposals/:proposalId/cancel"],
      ["POST", "/messaging-agent/projects/:projectId/messages/:messageId/retry"],
    ] as const) assert.equal(app.hasRoute({ method, url }), true, `${method} ${url}`);
    assert.equal((await app.inject({ url: "/messaging-agent/status" })).statusCode, 401);
    const challenge = await app.inject({ url: "/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=runtime-test&hub.challenge=12345" });
    assert.equal(challenge.statusCode, 200); assert.equal(challenge.body, "12345");
    assert.equal((await app.inject({ method: "POST", url: "/whatsapp/webhook", payload: { object: "whatsapp_business_account", entry: [] } })).statusCode, 403);

    await app.db("user").insert({ id: userId, name: "Runtime crew", email, emailVerified: true });
    await app.db("account").insert({ id: `wa-runtime-account-${suffix}`, accountId: userId, providerId: "credential", userId, password: await hashPassword(password) });
    await app.db("organization").insert({ id: organizationId, name: "Runtime fixture", slug: organizationId });
    await app.db("member").insert({ id: `wa-runtime-member-${suffix}`, organizationId, userId, role: "owner" });
    await app.db("projects").insert({ id: projectId, organization_id: organizationId, owner_id: userId, name: "Runtime site", address: "Fixture", status: "On Track", risk: "Low", currency: "NGN" });
    await app.db("buildings").insert({ id: buildingId, project_id: projectId, name: "Runtime block" });
    const signIn = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", headers: { host: "localhost:3000", origin: "http://localhost:5175" }, payload: { email, password } });
    assert.equal(signIn.statusCode, 200, signIn.body);
    const cookies = signIn.headers["set-cookie"];
    cookie = (Array.isArray(cookies) ? cookies : [cookies]).filter((value): value is string => typeof value === "string").map((value) => value.split(";", 1)[0]).join("; ");
    assert.ok(cookie);
    const status = await app.inject({ url: "/messaging-agent/status", headers: { cookie, origin: "http://localhost:5175" } });
    assert.equal(status.statusCode, 200, status.body); assert.equal(status.json().userId, userId);
    assert.equal(status.headers["access-control-allow-origin"], "http://localhost:5175");
    assert.equal(status.headers["access-control-allow-credentials"], "true");
    assert.equal(status.json().projects.some((project: { id: string }) => project.id === projectId), true);

    const unknownOverride = await app.inject({ method: "POST", url: "/messaging-agent/link", headers: { cookie }, payload: { channel: "whatsapp", accountId: phoneNumberId, projectId, buildingId, projectOverride: "foreign-project" } });
    assert.equal(unknownOverride.statusCode, 400);

    const linked = await app.inject({ method: "POST", url: "/messaging-agent/link", headers: { cookie }, payload: { channel: "whatsapp", accountId: phoneNumberId, projectId, buildingId } });
    assert.equal(linked.statusCode, 200, linked.body);
    const worker = messagingAgentWorker(app.db, {
      adapters: messagingAdapterRegistry([whatsappChannelAdapter(config.whatsapp, { sendText: async () => { throw new Error("No external sends in tests"); }, downloadAudio: async () => { throw new Error("Text fixture only"); } })]),
      draft: async (text, scope) => [{ kind: "daily_log", title: "Add daily site note", payload: { buildingId: scope.buildingId, logDate: "2026-11-14", bodyText: text } }],
    });
    async function inbound(text: string) {
      const providerMessageId = `wamid.runtime.${randomUUID()}`;
      const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: {
        metadata: { phone_number_id: phoneNumberId }, messages: [{ id: providerMessageId, from_user_id: senderId, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: text } }],
      } }] }] });
      const signature = "sha256=" + createHmac("sha256", "runtime-test").update(raw).digest("hex");
      const response = await app.inject({ method: "POST", url: "/whatsapp/webhook", headers: { "content-type": "application/json", "x-hub-signature-256": signature }, payload: raw });
      assert.equal(response.statusCode, 200, response.body);
      const inbox = await app.db("messaging_agent_inbox").where({ channel_account_id: phoneNumberId, provider_message_id: providerMessageId }).first();
      assert.ok(inbox); await worker.processInbox(inbox.id); return inbox.id as string;
    }
    await inbound(`LINK ${linked.json().code}`);
    const connectedStatus = await app.inject({ url: "/messaging-agent/status", headers: { cookie } });
    const connectionId = connectedStatus.json().connections[0].id;
    assert.ok(connectionId);
    const inboxId = await inbound("Twelve workers completed the slab.\n\nNo incidents.");
    const proposal = await app.db("messaging_agent_proposals").where({ inbox_id: inboxId }).first();
    assert.ok(proposal);
    assert.equal(Number((await app.db("daily_log_entries").where({ project_id: projectId }).count("* as count").first())!.count), 0);
    const session = await app.inject({ url: `/messaging-agent/projects/${projectId}/session?connectionId=${connectionId}`, headers: { cookie } });
    assert.equal(session.statusCode, 200, session.body); assert.equal(session.json().proposals[0].id, proposal.id);
    const confirm = () => app.inject({ method: "POST", url: `/messaging-agent/projects/${projectId}/proposals/${proposal.id}/confirm`, headers: { cookie }, payload: { version: proposal.version } });
    const result = await confirm(); assert.equal(result.statusCode, 200, result.body); assert.equal(result.json().status, "completed");
    assert.equal((await confirm()).json().result.recordId, result.json().result.recordId);
    assert.equal(Number((await app.db("daily_log_entries").where({ project_id: projectId }).count("* as count").first())!.count), 1);
    const unlink = await app.inject({ method: "DELETE", url: `/messaging-agent/connections/${connectionId}`, headers: { cookie } });
    assert.equal(unlink.statusCode, 204, unlink.body);
    assert.equal((await app.inject({ url: "/messaging-agent/status", headers: { cookie } })).json().connections.length, 0);
  } finally {
    await app.db("messaging_agent_inbox").where({ channel_account_id: phoneNumberId, sender_id: senderId }).delete();
    await app.db("projects").where({ id: projectId }).delete();
    await app.db("organization").where({ id: organizationId }).delete();
    await app.db("user").where({ id: userId }).delete();
    await app.close();
  }
});
