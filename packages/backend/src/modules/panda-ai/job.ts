import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { generateInsights } from "../../lib/insight-engine.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { buildProjectMetrics } from "./context.ts";
import { pandaAiRepository } from "./repository.ts";
import type { AiInsightResult, ProjectMetrics } from "./types.ts";

export const PANDA_AI_QUEUE = "panda-ai-analysis";

const HEALTH_DROP_THRESHOLD = 10;

export interface AnalysisJobData {
  insightId: string;
  projectId: string;
  orgId?: string;
}

async function notifyProjectInsights(
  db: Knex,
  queue: QueueManager,
  projectId: string,
  metrics: ProjectMetrics,
  result: AiInsightResult,
  previousScore: number | null,
): Promise<void> {
  const project = await db("projects")
    .select("owner_id")
    .where({ id: projectId })
    .first<{ owner_id: string | null }>();
  if (!project?.owner_id) return;
  const notifications = notificationsService(notificationsRepository(db), queue);

  if (metrics.overBudgetCategories > 0 && metrics.budgetVariance > 0) {
    const count = metrics.overBudgetCategories;
    void notifications
      .notify(project.owner_id, "budget_overrun", {
        title: "A budget category is over plan",
        body: `${count} cost ${count === 1 ? "category is" : "categories are"} over budget on ${metrics.projectName}.`,
        projectId,
      })
      .catch(() => undefined);
  }

  if (
    previousScore !== null &&
    previousScore - result.healthScore >= HEALTH_DROP_THRESHOLD
  ) {
    void notifications
      .notify(project.owner_id, "ai_health_drop", {
        title: "Project health score dropped",
        body: `Health fell from ${previousScore} to ${result.healthScore} on ${metrics.projectName}.`,
        projectId,
      })
      .catch(() => undefined);
  }
}

export async function runAnalysis(
  db: Knex,
  data: AnalysisJobData,
  queue?: QueueManager,
): Promise<void> {
  const repo = pandaAiRepository(db);
  const previous = await db("project_ai_insights")
    .where({ project_id: data.projectId, status: "complete" })
    .whereNot({ id: data.insightId })
    .whereNotNull("health_score")
    .orderBy("created_at", "desc")
    .first<{ health_score: number | null }>();
  const previousScore = previous?.health_score ?? null;

  await repo.markProcessing(data.insightId);
  try {
    const metrics = await buildProjectMetrics(db, data.projectId);
    const result = await generateInsights(metrics);
    await repo.markComplete(data.insightId, result, metrics);
    if (queue) {
      await notifyProjectInsights(db, queue, data.projectId, metrics, result, previousScore);
    }
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
    runAnalysis(db, data, manager),
  );
}
