import { Queue, Worker, type Job } from "bullmq";
import IORedis, { type Redis } from "ioredis";
import type { FastifyBaseLogger } from "fastify";

export type JobProcessor<TData = unknown> = (data: TData) => Promise<void>;

export type QueueMode = "redis" | "inline";

const DEFAULT_JOB_OPTS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2_000 },
  removeOnComplete: 100,
  removeOnFail: 500,
} as const;

/**
 * QueueManager wraps BullMQ so the rest of the app never imports bullmq
 * directly. When REDIS_URL is configured it uses a real Redis-backed queue and
 * spawns workers; when it is absent it falls back to an inline executor that
 * still runs the *real* processor out-of-band (deferred via setImmediate) so
 * background work happens for real in environments without Redis — it is a
 * degraded transport, never a stub.
 */
export class QueueManager {
  private readonly connection: Redis | null;
  private readonly queues = new Map<string, Queue>();
  private readonly workers = new Map<string, Worker>();
  private readonly processors = new Map<string, JobProcessor>();
  private started = false;

  readonly mode: QueueMode;

  constructor(
    redisUrl: string | null,
    private readonly logger: FastifyBaseLogger,
  ) {
    if (redisUrl) {
      // maxRetriesPerRequest must be null for BullMQ's blocking commands.
      this.connection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
      });
      this.connection.on("error", (err) => {
        this.logger.error({ err }, "Redis connection error");
      });
      this.mode = "redis";
    } else {
      this.connection = null;
      this.mode = "inline";
    }
  }

  /**
   * Register the processor for a queue. Must be called before startWorkers().
   */
  registerProcessor<TData>(
    queueName: string,
    processor: JobProcessor<TData>,
  ): void {
    if (this.processors.has(queueName)) {
      throw new Error(`Processor already registered for queue "${queueName}"`);
    }
    this.processors.set(queueName, processor as JobProcessor);
  }

  /**
   * Spin up a Worker per registered processor. No-op in inline mode.
   */
  startWorkers(): void {
    if (this.started) return;
    this.started = true;
    if (!this.connection) return;

    for (const [queueName, processor] of this.processors) {
      const worker = new Worker(
        queueName,
        async (job: Job) => {
          await processor(job.data);
        },
        { connection: this.connection, concurrency: 2 },
      );
      worker.on("failed", (job, err) => {
        this.logger.error(
          { err, jobId: job?.id, queue: queueName },
          "Background job failed",
        );
      });
      worker.on("completed", (job) => {
        this.logger.info(
          { jobId: job.id, queue: queueName },
          "Background job completed",
        );
      });
      this.workers.set(queueName, worker);
    }
  }

  private getQueue(queueName: string): Queue {
    if (!this.connection) {
      throw new Error("getQueue called without a Redis connection");
    }
    let queue = this.queues.get(queueName);
    if (!queue) {
      queue = new Queue(queueName, { connection: this.connection });
      this.queues.set(queueName, queue);
    }
    return queue;
  }

  /**
   * Enqueue a job. In redis mode it is persisted and picked up by a worker; in
   * inline mode it runs the processor out-of-band so the caller (e.g. an HTTP
   * handler) returns immediately while the work proceeds.
   */
  async enqueue<TData>(
    queueName: string,
    jobName: string,
    data: TData,
  ): Promise<void> {
    if (this.connection) {
      await this.getQueue(queueName).add(jobName, data, DEFAULT_JOB_OPTS);
      return;
    }

    const processor = this.processors.get(queueName);
    if (!processor) {
      throw new Error(`No processor registered for queue "${queueName}"`);
    }
    setImmediate(() => {
      void processor(data).catch((err) => {
        this.logger.error(
          { err, queue: queueName },
          "Inline background job failed",
        );
      });
    });
  }

  /**
   * Register and start a repeating background job. In redis mode the job is
   * scheduled via BullMQ's repeat option; in inline mode a setInterval drives it.
   * Call before startWorkers() or after — either way is safe.
   */
  startRepeating<TData>(
    queueName: string,
    intervalMs: number,
    processor: JobProcessor<TData>,
    data: TData,
  ): void {
    this.processors.set(queueName, processor as JobProcessor);

    if (this.connection) {
      const worker = new Worker(
        queueName,
        async (job: Job) => {
          await processor(job.data as TData);
        },
        { connection: this.connection, concurrency: 1 },
      );
      worker.on("failed", (job, err) => {
        this.logger.error({ err, jobId: job?.id, queue: queueName }, "Repeating job failed");
      });
      this.workers.set(queueName, worker);

      const queue = new Queue(queueName, { connection: this.connection });
      this.queues.set(queueName, queue);
      void queue.add(queueName, data, {
        repeat: { every: intervalMs },
        removeOnComplete: 10,
        removeOnFail: 50,
      });
    } else {
      setInterval(() => {
        void (processor(data) as Promise<void>).catch((err) => {
          this.logger.error({ err, queue: queueName }, "Inline repeating job failed");
        });
      }, intervalMs);
    }
  }

  /**
   * Gracefully drain workers, queues and the Redis connection.
   */
  async close(): Promise<void> {
    await Promise.all(
      [...this.workers.values()].map((worker) => worker.close()),
    );
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    if (this.connection) {
      await this.connection.quit();
    }
  }
}
