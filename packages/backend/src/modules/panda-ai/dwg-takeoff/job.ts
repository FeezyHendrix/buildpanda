import type { Knex } from "knex";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import type { QueueManager } from "../../../lib/queue/index.ts";
import { openStoredFile } from "../../../lib/file-storage.ts";
import { generateId } from "../../../lib/ids.ts";
import { takeoffJobsRepository } from "./jobs-repository.ts";
import { runDwgTakeoff } from "./engine.ts";
import { preconRepository } from "../pdf-takeoff/repository.ts";
import { preconService } from "../pdf-takeoff/service.ts";

// Queue name is the pre-rename "automated-takeoff" string: it is a BullMQ key
// in Redis, so changing it would strand jobs enqueued before a deploy.
export const TAKEOFF_QUEUE = "automated-takeoff";

export interface TakeoffJobData {
  jobId: string;
  orgId?: string;
  // set when the route already created the reviewable session up front
  sessionId?: string;
}

// LibreDWG reads from a file path, so the stored object is streamed to a temp
// file for the duration of the job and removed afterwards.
export async function withTempDwg<T>(storagePath: string, fn: (file: string) => Promise<T>): Promise<T> {
  const file = path.join(os.tmpdir(), `${generateId("tko")}.dwg`);
  const stream = await openStoredFile(storagePath);
  await pipeline(stream as Readable, createWriteStream(file));
  try {
    return await fn(file);
  } finally {
    await fs.rm(file, { force: true });
  }
}

export async function runTakeoff(db: Knex, data: TakeoffJobData): Promise<void> {
  const repo = takeoffJobsRepository(db);
  const job = await repo.rawById(data.jobId);
  if (!job) return;

  const precon = preconService(preconRepository(db));
  await repo.markProcessing(job.id);
  try {
    const result = await withTempDwg(job.storage_path, (file) => runDwgTakeoff(file));
    await repo.markComplete(job.id, result);
    // A proposal take-off becomes a reviewable session — the same object a PDF
    // produces — rather than lines appended straight onto the bill.
    if (data.sessionId) {
      await precon.fillDwgSession(data.sessionId, { fileName: job.file_name }, result.items);
    } else if (job.proposal_id) {
      const context = await repo.proposalContext(job.proposal_id, job.file_id);
      if (context) {
        const session = await precon.createDwgSession(
          context.orgId,
          job.requested_by ?? "system",
          job.proposal_id,
          context.planId,
          { fileName: job.file_name, storagePath: job.storage_path },
          result.items,
        );
        await repo.linkSession(job.id, session.id);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Take-off failed";
    await repo.markFailed(job.id, message);
    if (data.sessionId) await precon.failDwgSession(data.sessionId, message).catch(() => undefined);
    throw error;
  }
}

export function registerDwgTakeoffWorker(db: Knex, manager: QueueManager): void {
  manager.registerProcessor<TakeoffJobData>(TAKEOFF_QUEUE, (data) => runTakeoff(db, data));
}
