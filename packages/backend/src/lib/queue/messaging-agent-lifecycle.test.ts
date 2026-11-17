import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { Queue } from "bullmq";
import Fastify from "fastify";
import Redis from "ioredis";
import { QueueManager } from "./index.ts";
import { RealtimeHub } from "../realtime/index.ts";

const redisUrl = process.env.MESSAGING_AGENT_TEST_REDIS_URL;
const logger = Fastify({ logger: false }).log;

async function eventually(check: () => Promise<boolean> | boolean) {
  const expires = Date.now() + 5_000;
  while (!(await check())) {
    if (Date.now() >= expires) assert.fail("Background work did not reach the expected state");
    await delay(20);
  }
}

test("inline messaging-agent polling stops scheduling work after the queue manager closes", async () => {
  const manager = new QueueManager(null, logger);
  let runs = 0;
  try {
    manager.startRepeating("messaging-agent-inline-lifecycle", 20, async () => { runs += 1; }, {});
    manager.startWorkers();
    await eventually(() => runs > 0);
    await manager.close();
    const atClose = runs;
    await delay(80);
    assert.equal(runs, atClose);
  } finally { await manager.close(); }
});

test("realtime Redis can close immediately while its initial subscription is still connecting", { skip: !redisUrl }, async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const hub = new RealtimeHub(redisUrl!, logger);
    await delay(attempt % 3);
    await hub.close();
  }
  // Let rejected startup promises surface within this test's lifetime.
  await delay(40);
});

test("Redis polling starts one worker, commits one job, and closes every Redis connection it creates", { skip: !redisUrl }, async () => {
  const inspect = new Redis(redisUrl!, { maxRetriesPerRequest: null });
  const queueName = `messaging-agent-lifecycle-${randomUUID()}`;
  const queue = new Queue(queueName, { connection: inspect });
  const clientIds = async () => new Set((await inspect.client("LIST") as string).trim().split("\n").map((line) => line.split(" ")[0]!));
  const before = await clientIds();
  const manager = new QueueManager(redisUrl!, logger);
  const processed = new Set<number>();
  let executions = 0; let onceExecutions = 0; let closed = false;
  try {
    manager.startRepeating(queueName, 100, async () => { executions += 1; }, {});
    manager.registerProcessor(`${queueName}-once`, async (data: { marker: number }) => { onceExecutions += 1; processed.add(data.marker); });
    manager.startWorkers();
    await eventually(async () => executions > 0 && (await queue.getWorkers()).length > 0);
    assert.equal((await queue.getWorkers()).length, 1);
    await manager.enqueue(`${queueName}-once`, "one-capture", { marker: 1 });
    await eventually(() => processed.has(1));
    const created = [...await clientIds()].filter((id) => !before.has(id));
    assert.ok(created.length >= 3);
    await manager.close(); closed = true;
    assert.deepEqual(await queue.getWorkers(), []);
    const atClose = executions;
    await delay(250);
    assert.equal(executions, atClose);
    assert.equal(onceExecutions, 1);
    const remaining = await clientIds();
    assert.deepEqual(created.filter((id) => remaining.has(id)), []);
  } finally {
    if (!closed) await manager.close().catch(() => undefined);
    await queue.obliterate({ force: true });
    const once = new Queue(`${queueName}-once`, { connection: inspect });
    await once.obliterate({ force: true }); await once.close();
    await queue.close(); await inspect.quit();
  }
});
