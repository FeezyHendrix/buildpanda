import type { QueueManager } from "../../lib/queue/index.ts";
import { generateId } from "../../lib/ids.ts";
import { PANDA_AI_QUEUE, type AnalysisJobData } from "./job.ts";
import type { PandaAiRepository } from "./repository.ts";
import { toInsight, type Insight } from "./types.ts";

export function pandaAiService(
  repo: PandaAiRepository,
  queue: QueueManager,
) {
  return {
    async trigger(projectId: string, userId: string, orgId?: string): Promise<Insight> {
      const row = await repo.create({
        id: generateId("ai"),
        project_id: projectId,
        status: "pending",
        requested_by: userId,
      });
      const jobData: AnalysisJobData = {
        insightId: row.id,
        projectId,
        orgId,
      };
      await queue.enqueue(PANDA_AI_QUEUE, "analyze", jobData);
      return toInsight(row);
    },

    async getLatest(projectId: string): Promise<Insight | null> {
      const row = await repo.latestForProject(projectId);
      return row ? toInsight(row) : null;
    },
  };
}

export type PandaAiService = ReturnType<typeof pandaAiService>;
