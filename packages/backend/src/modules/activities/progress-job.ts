import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { recomputeProgress, recomputePhaseDateRanges } from "../../lib/schedule-cascade.ts";

export const PROGRESS_RECOMPUTE_QUEUE = "schedule-progress-recompute";

export interface ProgressRecomputeJobData {
  projectId: string;
}

export async function runProgressRecompute(db: Knex, data: ProgressRecomputeJobData): Promise<void> {
  await recomputePhaseDateRanges(db, data.projectId);
  await recomputeProgress(db, data.projectId);
}

export function registerProgressRecomputeWorker(db: Knex, manager: QueueManager): void {
  manager.registerProcessor<ProgressRecomputeJobData>(PROGRESS_RECOMPUTE_QUEUE, (data) =>
    runProgressRecompute(db, data),
  );
}
