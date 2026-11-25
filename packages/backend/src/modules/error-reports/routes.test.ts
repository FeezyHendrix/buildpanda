import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import errorHandler from "../../plugins/error-handler.ts";
import reportsPlugin from "../../plugins/error-reports.ts";
import { ForbiddenError } from "../../lib/errors.ts";
import reportsRoutes from "./routes.ts";
import { errorReportService } from "./service.ts";
import { browserReport } from "./test-fixtures.ts";
import type { ErrorReport } from "./types.ts";

async function fixture() {
  const reports: ErrorReport[] = [],
    recorded: ErrorReport[] = [];
  const service = errorReportService({
    enabled: true,
    environment: "test",
    release: "sha",
    enqueue: async (report) => {
      reports.push(report);
    },
    record: (report) => recorded.push(report),
    onFailure: () => undefined,
  });
  const app = Fastify({ logger: false, genReqId: () => randomUUID() });
  await app.register(reportsPlugin, {
    capture: (error, context) => service.capture(error, context),
  });
  await app.register(errorHandler);
  await app.register(rateLimit, { global: false });
  app.addHook("onRequest", async (request) => {
    const userId = request.headers["x-test-user"];
    request.user =
      typeof userId === "string"
        ? {
            id: userId,
            name: "Never sent",
            email: "private@example.test",
            emailVerified: true,
            image: null,
            role: "user",
          }
        : null;
    request.activeOrganizationId = "org_verified";
    request.orgRoles = new Map([["org_verified", "member"]]);
  });
  await app.register(reportsRoutes, {
    service,
    origins: ["https://app.example.test"],
  });
  app.post("/projects/:id/break", async () => {
    throw new Error("Broken request");
  });
  app.get("/projects/:id/denied", async () => {
    throw new ForbiddenError("Denied scope");
  });
  app.get("/sent-error", async (_request, reply) =>
    reply.code(409).send({ error: "Conflict" }),
  );
  await app.ready();
  return { app, reports, recorded, service };
}

test("HTTP failures report stack and request scope once, without headers, bodies, email or query values", async () => {
  const f = await fixture();
  try {
    const response = await f.app.inject({
      method: "POST",
      url: "/projects/prj_verified/break?token=private",
      headers: {
        "x-test-user": "usr_verified",
        authorization: "Bearer never-send",
      },
      payload: { password: "never-send", bankAccount: "never-send" },
    });
    assert.equal(response.statusCode, 500);
    assert.equal(response.json().error, "Internal server error");
    await f.service.flush();
    assert.equal(f.recorded.length, 1);
    const report = f.reports[0]!;
    assert.equal(report.context.userId, "usr_verified");
    assert.equal(report.context.organizationId, "org_verified");
    assert.equal(report.context.projectId, "prj_verified");
    assert.equal(report.context.requestId, response.headers["x-request-id"]);
    assert.equal(report.context.route, "/projects/:id/break");
    assert.equal(report.context.status, 500);
    assert.ok(report.stack.includes("Broken request"));
    assert.ok(!JSON.stringify(report).includes("never-send"));
    assert.ok(!JSON.stringify(report).includes("private@example.test"));
  } finally {
    await f.app.close();
  }
});

test("permission failures and explicit error replies remain unchanged and are reported", async () => {
  const f = await fixture();
  try {
    const denied = await f.app.inject("/projects/prj_other/denied");
    assert.equal(denied.statusCode, 403);
    const conflict = await f.app.inject("/sent-error");
    assert.equal(conflict.statusCode, 409);
    await f.service.flush();
    assert.equal(f.reports.length, 2);
    assert.ok(f.reports.every((report) => report.level === "warning"));
    assert.ok(
      f.reports.some(
        (report) =>
          report.context.status === 403 &&
          report.context.projectId === "prj_other",
      ),
    );
  } finally {
    await f.app.close();
  }
});

test("pre-login reports work from trusted origins; report identity comes from the authenticated server session", async () => {
  const f = await fixture();
  try {
    const first = await f.app.inject({
      method: "POST",
      url: "/error-reports",
      headers: { origin: "https://app.example.test" },
      payload: browserReport(),
    });
    assert.equal(first.statusCode, 202);
    const forged = await f.app.inject({
      method: "POST",
      url: "/error-reports",
      headers: {
        origin: "https://app.example.test",
        "x-test-user": "usr_real",
      },
      payload: {
        ...browserReport(),
        message: "Another failure",
        userId: "usr_spoof",
        organizationId: "org_spoof",
        password: "never-send",
      },
    });
    assert.equal(forged.statusCode, 202);
    await f.service.flush();
    assert.equal(f.recorded[0]!.context.userId, undefined);
    assert.equal(f.recorded[1]!.context.userId, "usr_real");
    assert.equal(f.recorded[1]!.context.organizationId, "org_verified");
    assert.ok(!JSON.stringify(f.recorded).includes("spoof"));
    assert.ok(!JSON.stringify(f.recorded).includes("never-send"));
    assert.equal(first.json().id, f.recorded[0]!.id);
  } finally {
    await f.app.close();
  }
});

test("untrusted origins, absent anonymous origins, oversized reports and malformed payloads cannot send notifications", async () => {
  const f = await fixture();
  try {
    for (const headers of [{ origin: "https://attacker.example.test" }, {}]) {
      const response = await f.app.inject({
        method: "POST",
        url: "/error-reports",
        headers,
        payload: browserReport(),
      });
      assert.equal(response.statusCode, 403);
    }
    const malformed = await f.app.inject({
      method: "POST",
      url: "/error-reports",
      headers: { origin: "https://app.example.test" },
      payload: {
        ...browserReport(),
        breadcrumbs: new Array(31).fill(browserReport().breadcrumbs[0]),
      },
    });
    assert.equal(malformed.statusCode, 400);
    const oversized = await f.app.inject({
      method: "POST",
      url: "/error-reports",
      headers: { origin: "https://app.example.test" },
      payload: { ...browserReport(), message: "x".repeat(50_000) },
    });
    assert.equal(oversized.statusCode, 413);
    await f.service.flush();
    assert.equal(f.recorded.length, 0);
  } finally {
    await f.app.close();
  }
});

test("public error intake is rate limited and reporting failures cannot start a reporting loop", async () => {
  const f = await fixture();
  try {
    let lastStatus = 0;
    for (let index = 0; index < 31; index += 1)
      lastStatus = (
        await f.app.inject({
          method: "POST",
          url: "/error-reports",
          headers: { origin: "https://app.example.test" },
          payload: {
            ...browserReport(),
            id: `event_number_${index}`,
            message: `Failure ${index}`,
          },
        })
      ).statusCode;
    assert.equal(lastStatus, 429);
    assert.equal(f.recorded.length, 30);
    await f.service.flush();
    assert.equal(f.recorded.length, 30);
  } finally {
    await f.app.close();
  }
});

test("page-exit batches preserve events and retrying the same client event does not double-count it", async () => {
  const f = await fixture();
  try {
    const one = browserReport(),
      two = {
        ...browserReport(),
        id: "second_event_123",
        message: "Second event",
      };
    const response = await f.app.inject({
      method: "POST",
      url: "/error-reports",
      headers: { origin: "https://app.example.test" },
      payload: { reports: [one, two] },
    });
    assert.equal(response.statusCode, 202, response.body);
    assert.equal(f.recorded.length, 2);
    await f.app.inject({
      method: "POST",
      url: "/error-reports",
      headers: { origin: "https://app.example.test" },
      payload: one,
    });
    await f.service.flush();
    assert.equal(f.recorded.length, 2);
  } finally {
    await f.app.close();
  }
});
