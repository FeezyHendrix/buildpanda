import assert from "node:assert/strict";
import { test } from "node:test";
import { UnrecoverableError } from "bullmq";
import { createSlackTransport, slackPayload } from "./slack.ts";
import { errorReportService } from "./service.ts";
import type { ErrorReport } from "./types.ts";

async function report(): Promise<ErrorReport> {
  let value: ErrorReport | undefined;
  const service = errorReportService({
    enabled: true,
    environment: "test",
    release: "sha123",
    record: () => undefined,
    enqueue: async (item) => {
      value = item;
    },
    onFailure: () => undefined,
  });
  const error = new Error("Cannot save expense");
  error.name = "<!channel> Error";
  service.capture(error, {
    kind: "http",
    status: 500,
    requestId: "request-123",
    route: "/projects/:id/transactions",
    method: "POST",
    userId: "usr123",
    projectId: "prj123",
  });
  await service.flush();
  assert.ok(value);
  return value;
}
const webhookUrl =
  "https://hooks.slack.com/services/TEST/TEST/test-placeholder";
test("Slack reports explain the observed failure and include IDs, stack and release without interpreting mentions", async () => {
  const event = await report(),
    payload = slackPayload(event),
    json = JSON.stringify(payload);
  assert.ok(json.includes("backend failed"));
  assert.ok(json.includes("request-123"));
  assert.ok(json.includes("sha123"));
  assert.ok(json.includes("prj123"));
  assert.ok(json.includes("Stack"));
  assert.ok(!payload.text.includes("<!channel>"));
  assert.ok(
    payload.blocks.every(
      (block) =>
        (block as { text: { type: string; text: string } }).text.type ===
        "plain_text",
    ),
  );
  for (const block of payload.blocks)
    assert.ok((block as { text: { text: string } }).text.text.length <= 3000);
});
test("delivery posts JSON with a timeout and never follows a redirect with the webhook secret", async () => {
  let body = "";
  const send = createSlackTransport({
    webhookUrl,
    fetch: async (url, init) => {
      assert.equal(url, webhookUrl);
      assert.equal(init?.redirect, "error");
      assert.ok(init?.signal);
      body = String(init?.body);
      return new Response("ok");
    },
  });
  await send(await report());
  assert.ok(body.includes("request-123"));
  assert.ok(!body.includes(webhookUrl));
});
test("Slack Retry-After is honored; network/5xx errors retry and permanent failures stop", async () => {
  const event = await report();
  assert.equal(
    await createSlackTransport({
      webhookUrl,
      fetch: async () =>
        new Response("limited", {
          status: 429,
          headers: { "Retry-After": "12" },
        }),
    })(event),
    12_000,
  );
  await assert.rejects(
    createSlackTransport({
      webhookUrl,
      fetch: async () => new Response("private response", { status: 500 }),
    })(event),
    /HTTP 500/,
  );
  await assert.rejects(
    createSlackTransport({
      webhookUrl,
      fetch: async () => new Response("private response", { status: 403 }),
    })(event),
    UnrecoverableError,
  );
  await assert.rejects(
    createSlackTransport({
      webhookUrl,
      fetch: async () => {
        throw new Error(webhookUrl);
      },
    })(event),
    (error: unknown) =>
      error instanceof Error && !error.message.includes(webhookUrl),
  );
});
test("only Slack HTTPS incoming webhooks are accepted", () => {
  for (const url of [
    "http://hooks.slack.com/services/T/B/key",
    "https://attacker.test/services/T/B/key",
    "https://hooks.slack.com.evil.test/services/key",
    "https://hooks.slack.com/services/T/B/key?token=private",
  ])
    assert.throws(() => createSlackTransport({ webhookUrl: url }));
});
