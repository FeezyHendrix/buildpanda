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
import { runTakeoffEngine } from "./takeoff-engine.ts";

export const TAKEOFF_QUEUE = "automated-takeoff";

export interface TakeoffJobData {
  jobId: string;
}

// LibreDWG reads from a file path, so the stored object is streamed to a temp
// file for the duration of the job and removed afterwards.
async function withTempDwg<T>(storagePath: string, fn: (file: string) => Promise<T>): Promise<T> {
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

  await repo.markProcessing(job.id);
  try {
    const result = await withTempDwg(job.storage_path, (file) => runTakeoffEngine(file));
    await repo.markComplete(job.id, result);
    if (job.proposal_id) {
      const maxSort = await db("proposal_boq_items")
        .where({ proposal_id: job.proposal_id })
        .max<{ sort: number | null }>("sort as sort")
        .first();
      const startSort = Number(maxSort?.sort ?? -1) + 1;
      if (result.items.length > 0) {
        await db("proposal_boq_items").insert(
          result.items.map((item, idx) => ({
            id: generateId("boq"),
            proposal_id: job.proposal_id,
            group_label: `AUTO TAKE-OFF — ${job.file_name}`,
          description: item.description,
            description_html: null,
          qty: item.quantity,
          unit: item.unit,
            sort: startSort + idx,
        })),
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Take-off failed";
    await repo.markFailed(job.id, message);
    throw error;
  }
}

export function registerTakeoffWorker(db: Knex, manager: QueueManager): void {
  manager.registerProcessor<TakeoffJobData>(TAKEOFF_QUEUE, (data) => runTakeoff(db, data));
}
