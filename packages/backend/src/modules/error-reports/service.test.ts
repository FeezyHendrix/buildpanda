import { browserReport } from "./test-fixtures.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { errorReportService } from "./service.ts";
import { redactText, safePath, safeTags } from "./redact.ts";
import type { ErrorReport } from "./types.ts";

function fixture(enabled = true) {
  const delivered: ErrorReport[] = [],
    recorded: ErrorReport[] = [],
    failures: string[] = [],
    timers: (() => void)[] = [];
  let time = Date.now();
  const service = errorReportService({
    enabled,
    environment: "test",
    release: "commit123",
    now: () => time,
    schedule: (callback) => {
      timers.push(callback);
      return {};
    },
    record: (report) => recorded.push(report),
    enqueue: async (report) => {
      delivered.push(report);
    },
    onFailure: (code) => failures.push(code),
  });
  return {
    service,
    delivered,
    recorded,
    failures,
    timers,
    tick: () => {
      time += 60_000;
    },
  };
}

test("redaction removes credentials, email, SQL values and signed/public URL secrets", () => {
  const secret = "never-send-this-value";
  const inputs = [
    `password=${secret}`,
    `data:text/plain,${secret}`,
    `Cookie: a=${secret}; b=${secret}`,
    `{"token":"${secret}"}`,
    `Authorization: Bearer ${secret}`,
    `https://hooks.slack.com/services/T/B/${secret}`,
    `https://storage.example.test/file.pdf?X-Amz-Signature=${secret}`,
    `https://app.example.test/public/invoices/${secret}`,
    `/auth/reset-password/${secret}`,
    `/files/file_123/view?token=${secret}`,
    `SELECT * FROM users WHERE password='${secret}' - rejected`,
  ];
  for (const text of inputs)
    assert.ok(!redactText(text).includes(secret), text);
  assert.ok(
    !redactText("email=person@example.test").includes("person@example.test"),
  );
  assert.equal(
    safePath(
      "https://app.example.test/public/invoices/secret/accept?token=hidden",
    ),
    "/public/[redacted]",
  );
  assert.equal(
    safePath("https://app.example.test/projects/p/stages?filter=private"),
    "/projects/p/stages",
  );
  assert.deepEqual(
    safeTags({
      area: "upload",
      projectId: "prj_123",
      password: secret,
      body: secret,
      email: secret,
      prompt: secret,
    }),
    { area: "upload", projectId: "prj_123" },
  );
});

test("backend reports preserve stack, cause, operation and verified scope without arbitrary payload fields", async () => {
  const f = fixture();
  const error = new Error("Upload failed", {
    cause: new Error("password=private"),
  });
  f.service.capture(error, {
    kind: "background",
    userId: "usr_1",
    projectId: "prj_1",
    queue: "invoice-email",
    tags: { area: "email", body: "private" },
  });
  await f.service.flush();
  assert.equal(f.delivered.length, 1);
  const report = f.delivered[0]!;
  assert.ok(report.stack.includes("Upload failed"));
  assert.ok(report.causes[0]?.includes("[redacted]"));
  assert.equal(report.context.userId, "usr_1");
  assert.equal(report.context.projectId, "prj_1");
  assert.equal(report.source, "backend");
  assert.ok(!JSON.stringify(report).includes("private"));
});

test("repeated errors retain every occurrence in logs and produce grouped Slack counts", async () => {
  const f = fixture();
  const make = () => {
    const error = new Error("Same failure");
    error.stack = "Error: Same failure\n at save (service.ts:10:2)";
    return error;
  };
  f.service.capture(make());
  f.service.capture(make());
  f.service.capture(make());
  assert.equal(f.recorded.length, 3);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(f.delivered.length, 1);
  f.tick();
  f.timers[0]!();
  await f.service.flush();
  assert.equal(f.delivered.length, 2);
  assert.equal(f.delivered[1]!.count, 2);
  assert.equal(f.delivered[1]!.fingerprint, f.delivered[0]!.fingerprint);
});

test("the same error reported by several hooks is counted once", async () => {
  const f = fixture(),
    error = new Error("One failure");
  f.service.capture(error);
  f.service.capture(error);
  await f.service.flush();
  assert.equal(f.recorded.length, 1);
  assert.equal(f.delivered.length, 1);
});

test("frontend reports use server identity, strip URL secrets, preserve breadcrumbs, and accept aggregated counts", async () => {
  const f = fixture(),
    input = browserReport();
  input.occurrences = 4;
  f.service.frontend(input, {
    userId: "verified_user",
    organizationId: "verified_org",
  });
  await f.service.flush();
  const report = f.delivered[0]!;
  assert.equal(report.source, "frontend");
  assert.equal(report.count, 4);
  assert.equal(report.context.userId, "verified_user");
  assert.equal(report.context.organizationId, "verified_org");
  assert.equal(report.client?.release, "commit123");
  assert.equal(report.client?.route, "/projects/prj_123/finances");
  assert.equal(report.client?.breadcrumbs[0]?.description, "button: Save");
  assert.ok(!JSON.stringify(report).includes("private"));
});

test("disabled delivery and sink failures never break application error handling", async () => {
  const off = fixture(false);
  off.service.capture(new Error("Off"));
  off.service.frontend(browserReport());
  await off.service.flush();
  assert.equal(off.delivered.length, 0);
  const failures: string[] = [];
  const service = errorReportService({
    enabled: true,
    environment: "test",
    release: "test",
    record: () => undefined,
    enqueue: async () => {
      throw new Error("Down");
    },
    onFailure: (code) => failures.push(code),
  });
  assert.doesNotThrow(() => service.capture(new Error("App error")));
  await service.flush();
  assert.deepEqual(failures, ["enqueue_failed"]);
});

test("error-sink delivery failures do not enqueue reports about themselves", async () => {
  const f = fixture();
  f.service.capture(new Error("Slack down"), { queue: "error-reports" });
  f.service.capture(new Error("Slack down"), {
    tags: { queue: "error-reports" },
  });
  await f.service.flush();
  assert.equal(f.delivered.length, 0);
});

test("structured exceptions preserve their safe message and stack without serializing other fields", async () => {
  const f = fixture();
  f.service.capture({
    name: "StructuredFailure",
    message: "Could not save",
    stack: "at save (service.ts:1:2)",
    password: "never-send",
  });
  await f.service.flush();
  assert.equal(f.delivered[0]!.name, "StructuredFailure");
  assert.equal(f.delivered[0]!.message, "Could not save");
  assert.ok(f.delivered[0]!.stack.includes("at save"));
  assert.ok(!JSON.stringify(f.delivered).includes("never-send"));
  assert.equal(safePath("data:text/plain,never-send"), "[data resource]");
});
