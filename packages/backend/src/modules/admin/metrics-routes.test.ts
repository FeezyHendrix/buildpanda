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
  for (const path of ["overview", "growth", "signup-journey", "engagement", "ai-ops"]) {
    const res = await app.inject({ method: "GET", url: `/admin/metrics/${path}` });
    assert.equal(res.statusCode, 403, path);
  }
  await app.close();
});
