import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { openStoredFile, streamToBuffer } from "../../lib/file-storage.ts";
import { extractMaterialsFromBoq } from "./boq-import.ts";
import { boqJobsRepository } from "./boq-jobs-repository.ts";

export const BOQ_IMPORT_QUEUE = "boq-import-extraction";

export interface BoqImportJobData {
  jobId: string;
}

export async function runBoqImport(db: Knex, data: BoqImportJobData): Promise<void> {
  const repo = boqJobsRepository(db);
  const job = await repo.rawById(data.jobId);
  if (!job) return;
  await repo.markProcessing(job.id);
  try {
    const stream = await openStoredFile(job.storage_path);
    const buffer = await streamToBuffer(stream);
    const result = await extractMaterialsFromBoq(buffer, job.file_name, "");
    await repo.markComplete(job.id, result.materials, result.usedAi);
  } catch (error) {
    const message = error instanceof Error ? error.message : "BoQ extraction failed";
    await repo.markFailed(job.id, message);
    throw error;
  }
}

export function registerBoqImportWorker(db: Knex, manager: QueueManager): void {
  manager.registerProcessor<BoqImportJobData>(BOQ_IMPORT_QUEUE, (data) =>
    runBoqImport(db, data),
  );
}
