import type { Knex } from "knex";
import type { FastifyBaseLogger } from "fastify";
import type { QueueManager } from "../../lib/queue/index.ts";
import { generateId } from "../../lib/ids.ts";
import { pandaAiRepository } from "./repository.ts";
import { PANDA_AI_QUEUE, type AnalysisJobData } from "./job.ts";

export const PANDA_AI_PERIODIC_QUEUE = "panda-ai-periodic";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1_000;

export interface PeriodicTickData {
  _tick: number;
}

export interface PeriodicTickResult {
  queued: number;
  skippedUnchanged: number;
  errored: number;
}

export async function runPeriodicTick(
  db: Knex,
  manager: QueueManager,
): Promise<PeriodicTickResult> {
  const repo = pandaAiRepository(db);
  const projectIds = await repo.listProjectIds();
  const result: PeriodicTickResult = {
    queued: 0,
    skippedUnchanged: 0,
    errored: 0,
  };

  for (const projectId of projectIds) {
    try {
      const needsAnalysis = await repo.hasUnanalyzedChanges(projectId);
      if (!needsAnalysis) {
        result.skippedUnchanged += 1;
        continue;
      }
      const row = await repo.create({
        id: generateId("ai"),
        project_id: projectId,
        status: "pending",
        requested_by: null,
      });
      const project = await db("projects")
        .where({ id: projectId })
        .first<{ organization_id: string | null }>("organization_id");
      const jobData: AnalysisJobData = {
        insightId: row.id,
        projectId,
        orgId: project?.organization_id ?? undefined,
      };
      await manager.enqueue(PANDA_AI_QUEUE, "analyze", jobData);
      await repo.pruneInsights(projectId);
      result.queued += 1;
    } catch {
      result.errored += 1;
    }
  }

  return result;
}

export function registerPandaAiPeriodicScheduler(
  db: Knex,
  manager: QueueManager,
  logger: FastifyBaseLogger,
): void {
  manager.startRepeating<PeriodicTickData>(
    PANDA_AI_PERIODIC_QUEUE,
    FOUR_HOURS_MS,
    async () => {
      const summary = await runPeriodicTick(db, manager);
      logger.info(
        { queue: PANDA_AI_PERIODIC_QUEUE, ...summary },
        "panda-ai periodic tick complete",
      );
    },
    { _tick: 0 },
  );
}
