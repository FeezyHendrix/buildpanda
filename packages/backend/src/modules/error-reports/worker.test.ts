import assert from "node:assert/strict";
import { test } from "node:test";
import { UnrecoverableError } from "bullmq";
import { bindErrorQueue } from "./runtime.ts";
import { errorReportService } from "./service.ts";
import type { DeliveryJob, ErrorQueue, ErrorReport } from "./types.ts";
import type { JobProcessor } from "../../lib/queue/index.ts";

async function setup(
  send: (report: ErrorReport) => Promise<number | undefined>,
) {
  let processor: JobProcessor<DeliveryJob> | undefined;
  const jobs: { name: string; data: DeliveryJob; delayMs?: number }[] = [];
  const queue: ErrorQueue = {
    registerProcessor(name, handler, options) {
      assert.equal(name, "error-reports");
      assert.deepEqual(options, {
        concurrency: 1,
        limiter: { max: 1, duration: 1000 },
      });
      processor = handler as JobProcessor<DeliveryJob>;
    },
    async enqueue(_queue, name, data, options) {
      jobs.push({ name, data: data as DeliveryJob, delayMs: options?.delayMs });
    },
  };
  await bindErrorQueue(queue, true, send);
  assert.ok(processor);
  let report: ErrorReport | undefined;
  const service = errorReportService({
    enabled: true,
    environment: "test",
    release: "test",
    record: () => undefined,
    enqueue: async (event) => {
      report = event;
    },
    onFailure: () => undefined,
  });
  service.capture(new Error("Original failure"));
  await service.flush();
  assert.ok(report);
  return { run: processor, report, jobs };
}
test("rate limited delivery is rescheduled using Slack's Retry-After", async () => {
  const f = await setup(async () => 12_000);
  await f.run({ report: f.report });
  assert.equal(f.jobs[0]?.delayMs, 12_000);
  assert.equal(f.jobs[0]?.name, "rate-limited");
  assert.equal(f.jobs[0]?.data.report.id, f.report.id);
});
test("transient delivery errors retry with backoff without reporting themselves", async () => {
  const f = await setup(async () => {
    throw new Error("Transport unavailable");
  });
  await f.run({ report: f.report });
  assert.equal(f.jobs[0]?.delayMs, 5000);
  assert.equal(f.jobs[0]?.data.retry, 1);
  assert.equal(f.jobs[0]?.data.report.id, f.report.id);
});
test("permanent webhook failures and exhausted retries stop", async () => {
  const permanent = await setup(async () => {
    throw new UnrecoverableError("Webhook revoked");
  });
  await assert.rejects(
    permanent.run({ report: permanent.report }),
    UnrecoverableError,
  );
  assert.equal(permanent.jobs.length, 0);
  const exhausted = await setup(async () => {
    throw new Error("Unavailable");
  });
  await assert.rejects(
    exhausted.run({ report: exhausted.report, retry: 7 }),
    /Unavailable/,
  );
  assert.equal(exhausted.jobs.length, 0);
});
