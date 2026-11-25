import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import Fastify from "fastify";
import { Queue } from "bullmq";
import { QueueManager } from "../../lib/queue/index.ts";

const redisUrl = process.env["ERROR_SINK_TEST_REDIS_URL"];
test(
  "queued delivery survives a producer restart and the rate limit applies across workers",
  {
    skip: redisUrl
      ? false
      : "Set ERROR_SINK_TEST_REDIS_URL to an isolated Redis database.",
  },
  async () => {
    const name = `error-sink-test-${randomUUID()}`,
      logger = Fastify({ logger: false }).log;
    const producer = new QueueManager(redisUrl!, logger),
      one = new QueueManager(redisUrl!, logger),
      two = new QueueManager(redisUrl!, logger);
    const starts: number[] = [],
      received: number[] = [];
    let notify: (() => void) | undefined;
    const complete = new Promise<void>((resolve) => {
      notify = resolve;
    });
    for (const manager of [one, two])
      manager.registerProcessor<number>(
        name,
        async (data) => {
          starts.push(Date.now());
          received.push(data);
          if (received.length === 3) notify!();
        },
        { concurrency: 1, limiter: { max: 1, duration: 1000 } },
      );
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      for (const value of [1, 2, 3])
        await producer.enqueue(name, "deliver", value);
      await producer.close();
      one.startWorkers();
      two.startWorkers();
      await Promise.race([
        complete,
        new Promise((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Redis delivery timed out")),
            15_000,
          );
        }),
      ]);
      assert.deepEqual(received.sort(), [1, 2, 3]);
      const times = starts.sort((a, b) => a - b);
      assert.ok(times[1]! - times[0]! >= 900);
      assert.ok(times[2]! - times[1]! >= 900);
    } finally {
      if (timeout) clearTimeout(timeout);
      await one.close();
      await two.close();
      const url = new URL(redisUrl!);
      const cleanup = new Queue(name, {
        connection: {
          host: url.hostname,
          port: Number(url.port),
          db: Number(url.pathname.slice(1)),
          ...(url.password
            ? { password: decodeURIComponent(url.password) }
            : {}),
        },
      });
      await cleanup.obliterate();
      await cleanup.close();
    }
  },
);
