import assert from "node:assert/strict";
import { test } from "node:test";
import { Writable } from "node:stream";
import Fastify from "fastify";
import type { DeliveryJob, ErrorQueue, ErrorReport } from "./types.ts";

process.env["ERROR_SINK_SLACK_WEBHOOK_URL"] =
  "https://hooks.slack.com/services/TEST/TEST/local-test-only";
const runtime = await import("./runtime.ts");
const { default: reportsPlugin } = await import(
  "../../plugins/error-reports.ts"
);
const reports: ErrorReport[] = [];
const queue: ErrorQueue = {
  registerProcessor: () => undefined,
  enqueue: async (_queue, _name, data) => {
    reports.push((data as DeliveryJob).report);
  },
};
await runtime.bindErrorQueue(queue, false, async () => undefined);

test("logged errors and warnings retain isolated user/request context across concurrent requests", async () => {
  const app = Fastify({
    logger: {
      level: "info",
      stream: new Writable({
        write(_chunk, _encoding, done) {
          done();
        },
      }),
      hooks: {
        logMethod(args, method, level) {
          if (level >= 40)
            runtime.captureErrorLog(args, this.bindings(), level);
          method.apply(this, args);
        },
      },
    },
  });
  await app.register(reportsPlugin);
  app.addHook("onRequest", async (request) => {
    request.user = {
      id: String(request.headers["x-test-user"]),
      name: "Private name",
      email: "private@example.test",
      image: null,
      role: "user",
      emailVerified: true,
    };
  });
  app.get<{ Params: { id: string } }>(
    "/projects/:id/logged",
    async (request) => {
      await new Promise((resolve) =>
        setTimeout(resolve, request.params.id === "project_a" ? 20 : 5),
      );
      request.log.warn(
        { err: new Error(`Handled failure ${request.params.id}`) },
        "Handled warning",
      );
      return { ok: true };
    },
  );
  try {
    await app.ready();
    await Promise.all([
      app.inject({
        url: "/projects/project_a/logged",
        headers: { "x-test-user": "user_a" },
      }),
      app.inject({
        url: "/projects/project_b/logged",
        headers: { "x-test-user": "user_b" },
      }),
    ]);
    await runtime.flushErrorSink();
    assert.equal(reports.length, 2);
    assert.equal(
      reports.find((r) => r.context.projectId === "project_a")!.context.userId,
      "user_a",
    );
    assert.equal(
      reports.find((r) => r.context.projectId === "project_b")!.context.userId,
      "user_b",
    );
    assert.notEqual(
      reports[0]!.context.requestId,
      reports[1]!.context.requestId,
    );
    assert.ok(!JSON.stringify(reports).includes("private@example.test"));
    runtime.captureErrorLog(["Ordinary warning"], {}, 40);
    await runtime.flushErrorSink();
    assert.equal(reports.length, 2);
  } finally {
    await app.close();
  }
});

test("fatal logs preserve their operation, and delivery errors never enter the sink again", async () => {
  const before = reports.length;
  runtime.captureErrorLog(
    [{ err: new Error("Fatal fixture failure") }, "Uncaught exception"],
    {},
    60,
  );
  runtime.captureErrorLog(
    [
      { err: new Error("Slack failure"), queue: "error-reports" },
      "Delivery failed",
    ],
    {},
    50,
  );
  await runtime.flushErrorSink();
  assert.equal(reports.length, before + 1);
  assert.equal(reports.at(-1)?.kind, "fatal");
  assert.equal(reports.at(-1)?.context.operation, "Uncaught exception");
});
