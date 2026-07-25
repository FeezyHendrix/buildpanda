import type { Knex } from "knex";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { QueueManager } from "../../../lib/queue/index.ts";
import { openStoredFile, streamToBuffer } from "../../../lib/file-storage.ts";
import { extractProgramme } from "./import.ts";
import { programmeJobsRepository } from "./jobs-repository.ts";

export const PROGRAMME_IMPORT_QUEUE = "programme-import-extraction";

export interface ProgrammeImportJobData {
  jobId: string;
  orgId?: string;
}

export async function runProgrammeImport(db: Knex, data: ProgrammeImportJobData): Promise<void> {
  const repo = programmeJobsRepository(db);
  const job = await repo.rawById(data.jobId);
  if (!job) return;
  await repo.markProcessing(job.id);
  const workDir = mkdtempSync(join(tmpdir(), "panda-pgm-"));
  try {
    const stream = await openStoredFile(job.storage_path);
    const buffer = await streamToBuffer(stream);
    const result = await extractProgramme(buffer, job.file_name, workDir);
    await repo.markComplete(job.id, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Programme extraction failed";
    await repo.markFailed(job.id, message);
    throw error;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

export function registerProgrammeImportWorker(db: Knex, manager: QueueManager): void {
  manager.registerProcessor<ProgrammeImportJobData>(PROGRAMME_IMPORT_QUEUE, (data) =>
    runProgrammeImport(db, data),
  );
}
