import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import { isMessagingWebhook } from "./public-webhooks.ts";
import { UnauthorizedError } from "./errors.ts";
import errorHandler from "../plugins/error-handler.ts";

test("only server-marked adapter GET/POST routes skip browser authentication across providers", async () => {
  const app = Fastify({ logger: false });
  await app.register(errorHandler);
  app.addHook("preHandler", async (request) => {
    if (!isMessagingWebhook(request)) throw new UnauthorizedError();
  });
  for (const url of ["/provider-a/webhook", "/provider-b/events"]) {
    app.route({ method: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], url,
      config: { messagingWebhook: true }, handler: async () => ({ transport: true }) });
  }
  for (const url of ["/whatsapp/webhook", "/messaging-agent/status", "/messaging-agent/link", "/provider-a/webhook/management"]) {
    app.route({ method: ["GET", "POST"], url, handler: async () => ({ protected: true }) });
  }
  try {
    for (const url of ["/provider-a/webhook", "/provider-b/events"]) {
      for (const method of ["GET", "POST"] as const) {
        assert.equal((await app.inject({ method, url })).statusCode, 200, `${method} ${url}`);
      }
      for (const method of ["HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"] as const) {
        assert.equal((await app.inject({ method, url })).statusCode, 401, `${method} ${url}`);
      }
    }
    for (const url of ["/whatsapp/webhook", "/messaging-agent/status", "/messaging-agent/link", "/provider-a/webhook/management"]) {
      const response = await app.inject({ method: "POST", url: `${url}?messagingWebhook=true`,
        headers: { "x-messaging-webhook": "true" }, payload: { messagingWebhook: true, routeOptions: { config: { messagingWebhook: true } } } });
      assert.equal(response.statusCode, 401, url);
      assert.equal(response.json().code, "unauthorized");
    }
  } finally { await app.close(); }
});
