import "./instrument.ts";
import cluster from "node:cluster";
import os from "node:os";
import { config } from "./config/index.ts";
import db from "./db/connection.ts";
import { runMigrations } from "./db/migrations-runner.ts";
import { start } from "./server.ts";

const WORKER_ROLE_ENV = "RUN_WORKERS";

function resolveWorkerCount(): number {
  const configured = config.cluster.workers;
  if (configured > 0) return configured;
  return Math.max(1, os.cpus().length);
}

function clusteringDisabled(): boolean {
  const redisConfigured = Boolean(config.redis.url);
  return !redisConfigured || resolveWorkerCount() <= 1;
}

async function runSingleProcess(): Promise<void> {
  await start();
}

function forkWorker(workerFork: Set<number>, runsWorkers: boolean): void {
  const worker = cluster.fork({ [WORKER_ROLE_ENV]: runsWorkers ? "true" : "false" });
  if (runsWorkers) workerFork.add(worker.id);
}

function runPrimary(workerCount: number): void {
  const log = (msg: string, extra: Record<string, unknown> = {}): void => {
    process.stdout.write(`${JSON.stringify({ level: "info", scope: "cluster", msg, ...extra })}\n`);
  };

  log("primary starting", { pid: process.pid, workers: workerCount });

  const workerFork = new Set<number>();
  forkWorker(workerFork, true);
  for (let i = 1; i < workerCount; i += 1) {
    forkWorker(workerFork, false);
  }

  let shuttingDown = false;

  cluster.on("exit", (worker, code, signal) => {
    const wasWorkerFork = workerFork.delete(worker.id);
    log("worker exited", { workerId: worker.id, workerPid: worker.process.pid, code, signal, wasWorkerFork });
    if (shuttingDown) return;
    forkWorker(workerFork, wasWorkerFork);
  });

  const broadcast = (signal: NodeJS.Signals): void => {
    shuttingDown = true;
    log("primary shutting down", { signal });
    for (const worker of Object.values(cluster.workers ?? {})) {
      worker?.kill(signal);
    }
  };

  process.on("SIGTERM", () => broadcast("SIGTERM"));
  process.on("SIGINT", () => broadcast("SIGINT"));
}

async function migrateOnce(): Promise<void> {
  try {
    await runMigrations(db);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ level: "fatal", scope: "migrations", msg: "migration failed", error: String(error) })}\n`,
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  if (clusteringDisabled()) {
    await migrateOnce();
    await runSingleProcess();
    return;
  }

  if (cluster.isPrimary) {
    await migrateOnce();
    runPrimary(resolveWorkerCount());
    return;
  }

  await start();
}

void main();
