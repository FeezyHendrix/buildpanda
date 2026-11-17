import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import adminRoutes from "./routes.ts";

// The metrics routes live in a child plugin; they must still inherit the admin gate.
test("metrics routes sit behind the admin gate", async () => {
  const app = Fastify({ logger: false });
  app.decorate("db", (() => {
    throw new Error("gate let the request through to the database");
  }) as never);
  app.decorateRequest("requireAdmin", () => {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  });
  await app.register(adminRoutes);
  await app.ready();
  for (const path of ["metrics/overview", "metrics/growth", "metrics/signup-journey", "metrics/engagement", "metrics/ai-ops", "product-discovery"]) {
    const res = await app.inject({ method: "GET", url: `/admin/${path}` });
    assert.equal(res.statusCode, 403, path);
  }
  await app.close();
});
