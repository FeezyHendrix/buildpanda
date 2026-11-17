import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import { UnauthorizedError } from "../../lib/errors.ts";
import errorHandler from "../../plugins/error-handler.ts";
import messagingAgentRoutes from "./routes.ts";
import * as schemas from "./schemas.ts";

const project = "/messaging-agent/projects/project-a";
const proposal = `${project}/proposals/proposal-a`;
type ManagementMethod = "GET" | "POST" | "PATCH" | "DELETE";
const protectedRequests: { method: ManagementMethod; url: string; payload?: object }[] = [
  { method: "GET", url: "/messaging-agent/status" },
  { method: "POST", url: "/messaging-agent/link", payload: { channel: "whatsapp", accountId: "account-a", projectId: "project-a", buildingId: "building-a" } },
  { method: "DELETE", url: "/messaging-agent/connections/connection-a" },
  { method: "GET", url: `${project}/session?connectionId=connection-a` },
  { method: "PATCH", url: `${project}/scope`, payload: { connectionId: "connection-a", buildingId: "building-a" } },
  { method: "POST", url: `${project}/proposals`, payload: { connectionId: "connection-a", text: "Ten workers on site." } },
  { method: "POST", url: `${project}/messages/message-a/retry` },
  { method: "PATCH", url: proposal, payload: { version: 1, actions: [{ kind: "daily_log", payload: {} }] } },
  { method: "POST", url: `${proposal}/confirm`, payload: { version: 1 } },
  { method: "POST", url: `${proposal}/cancel`, payload: { version: 1 } },
];

async function managementApp() {
  const app = Fastify({ logger: false });
  let authChecks = 0;
  app.decorate("db", (() => { throw new Error("Unauthenticated request reached the database"); }) as never);
  app.decorateRequest("requireAuth", () => {
    authChecks += 1;
    throw new UnauthorizedError();
  });
  await app.register(errorHandler);
  await app.register(messagingAgentRoutes);
  await app.ready();
  return { app, authChecks: () => authChecks };
}

test("every messaging-agent management route authenticates before accessing its service", async () => {
  const { app, authChecks } = await managementApp();
  try {
    for (const request of protectedRequests) {
      const result = await app.inject(request);
      assert.equal(result.statusCode, 401, `${request.method} ${request.url}`);
      assert.equal(result.json().code, "unauthorized");
    }
    assert.equal(authChecks(), protectedRequests.length);
  } finally { await app.close(); }
});

test("management schemas reject invalid mutation bodies before service execution", async () => {
  const { app, authChecks } = await managementApp();
  const invalid: { method: ManagementMethod; url: string; payload: object }[] = [
    { method: "POST", url: "/messaging-agent/link", payload: {} },
    { method: "POST", url: "/messaging-agent/link", payload: { projectId: "" } },
    { method: "PATCH", url: `${project}/scope`, payload: {} },
    { method: "POST", url: `${project}/proposals`, payload: { connectionId: "connection-a", text: "" } },
    { method: "POST", url: `${project}/proposals`, payload: { connectionId: "connection-a", text: "x".repeat(20_001) } },
    { method: "PATCH", url: proposal, payload: { version: 1, actions: [] } },
    { method: "PATCH", url: proposal, payload: { version: 1, actions: [{ kind: "expense", payload: {} }] } },
    { method: "PATCH", url: proposal, payload: { version: 1, actions: [{ kind: "daily_log" }] } },
    { method: "POST", url: `${proposal}/confirm`, payload: { version: 0 } },
    { method: "POST", url: `${proposal}/cancel`, payload: {} },
  ];
  try {
    for (const request of invalid) {
      const result = await app.inject(request);
      assert.equal(result.statusCode, 400, `${request.method} ${request.url}: ${JSON.stringify(request.payload)}`);
      assert.equal(result.json().code, "validation_failed");
    }
    assert.equal(authChecks(), 0);
  } finally { await app.close(); }
});

test("response schemas expose only allowed status, session and proposal fields", async () => {
  const app = Fastify({ logger: false });
  const secret = { sender_id: "provider-sender", code_hash: "secret-hash", user_id: "other-user" };
  const draft = {
    id: "proposal-a", version: 2, status: "draft", title: "Site note", summary: "Ten workers.", createdAt: "2026-11-14T12:00:00.000Z", ...secret,
    actions: [{ kind: "daily_log", title: "Add note", payload: { bodyText: "Ten workers." }, missing: [], ...secret }],
    result: { recordId: "entry-a", message: "Saved", ...secret },
  };
  app.get("/status", { schema: { response: { 200: schemas.statusResponse } } }, async () => ({
    userId: "caller", enabled: true, ...secret,
    channels: [{ id: "fixture-channel", accountId: "account-a", label: "Fixture Messenger", enabled: true, ...secret }],
    connections: [{ id: "connection-a", channel: "fixture-channel", accountId: "account-a", channelLabel: "Fixture Messenger", linkedAt: "2026-11-14T12:00:00.000Z", selectedScope: { projectId: "project-a", buildingId: "building-a" }, ...secret }],
    projects: [{ id: "project-a", name: "Site", organizationId: "org-a", ...secret }],
  }));
  app.get("/session", { schema: { response: { 200: schemas.sessionResponse } } }, async () => ({
    connectionId: "connection-a", projectId: "project-a", organizationId: "org-a", buildingId: "building-a", ...secret,
    permissions: { dailyLog: ["view", "create"] },
    buildings: [{ id: "building-a", name: "Block A", ...secret }],
    messages: [{ id: "message-a", role: "user", inputType: "audio", text: "Ten workers.", createdAt: "2026-11-14T12:00:00.000Z", ...secret }],
    proposals: [draft],
  }));
  app.get("/proposal", { schema: { response: { 200: schemas.proposalResponse } } }, async () => draft);
  try {
    for (const path of ["/status", "/session", "/proposal"]) {
      const result = await app.inject({ method: "GET", url: path });
      assert.equal(result.statusCode, 200, result.body);
      for (const key of Object.keys(secret)) assert.equal(result.body.includes(key), false, `${path} exposed ${key}`);
    }
    const result = await app.inject({ method: "GET", url: "/session" });
    assert.equal(result.json().messages[0].inputType, "audio");
    assert.equal(result.json().proposals[0].actions[0].payload.bodyText, "Ten workers.");
  } finally { await app.close(); }
});
