import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { generateInsights } from "../../lib/kimi.ts";
import { buildProjectMetrics } from "./context.ts";
import { pandaAiRepository } from "./repository.ts";

export const PANDA_AI_QUEUE = "panda-ai-analysis";

export interface AnalysisJobData {
  insightId: string;
  projectId: string;
}

export async function runAnalysis(
  db: Knex,
  data: AnalysisJobData,
): Promise<void> {
  const repo = pandaAiRepository(db);
  await repo.markProcessing(data.insightId);
  try {
    const metrics = await buildProjectMetrics(db, data.projectId);
    const result = await generateInsights(metrics);
    await repo.markComplete(data.insightId, result, metrics);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    await repo.markFailed(data.insightId, message);
    throw error;
  }
}

export function registerPandaAiWorker(
  db: Knex,
  manager: QueueManager,
): void {
  manager.registerProcessor<AnalysisJobData>(PANDA_AI_QUEUE, (data) =>
    runAnalysis(db, data),
  );
}
