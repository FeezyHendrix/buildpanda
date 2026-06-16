import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { openStoredFile, streamToBuffer } from "../../lib/file-storage.ts";
import { extractProjectFromFile } from "./project-extraction.ts";
import { projectFileJobsRepository } from "./project-file-jobs-repository.ts";

export const PROJECT_FILE_IMPORT_QUEUE = "project-file-extraction";

export interface ProjectFileImportJobData {
  jobId: string;
}

export async function runProjectFileImport(
  db: Knex,
  data: ProjectFileImportJobData,
): Promise<void> {
  const repo = projectFileJobsRepository(db);
  const job = await repo.rawById(data.jobId);
  if (!job) return;
  await repo.markProcessing(job.id);
  try {
    const stream = await openStoredFile(job.storage_path);
    const buffer = await streamToBuffer(stream);
    const extraction = await extractProjectFromFile(buffer, job.file_name);
    await repo.markComplete(job.id, extraction);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Project file extraction failed";
    await repo.markFailed(job.id, message);
    throw error;
  }
}

export function registerProjectFileImportWorker(db: Knex, manager: QueueManager): void {
  manager.registerProcessor<ProjectFileImportJobData>(PROJECT_FILE_IMPORT_QUEUE, (data) =>
    runProjectFileImport(db, data),
  );
}
