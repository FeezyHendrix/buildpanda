import type { Knex } from "knex";
import type {
  AiInsightResult,
  InsightRow,
  InsightStatus,
  ProjectMetrics,
} from "./types.ts";

export interface NewInsightRecord {
  id: string;
  project_id: string;
  status: InsightStatus;
  requested_by: string | null;
}

export function pandaAiRepository(db: Knex) {
  return {
    async create(record: NewInsightRecord): Promise<InsightRow> {
      const [row] = await db<InsightRow>("project_ai_insights")
        .insert(record)
        .returning("*");
      if (!row) throw new Error("Failed to insert AI insight");
      return row;
    },

    findById(id: string): Promise<InsightRow | undefined> {
      return db<InsightRow>("project_ai_insights").where({ id }).first();
    },

    latestForProject(projectId: string): Promise<InsightRow | undefined> {
      return db<InsightRow>("project_ai_insights")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc")
        .first();
    },

    async markProcessing(id: string): Promise<void> {
      await db("project_ai_insights")
        .where({ id })
        .update({ status: "processing", updated_at: db.fn.now() });
    },

    async markComplete(
      id: string,
      result: AiInsightResult,
      metrics: ProjectMetrics,
    ): Promise<void> {
      await db("project_ai_insights")
        .where({ id })
        .update({
          status: "complete",
          summary: result.summary,
          suggestions: JSON.stringify(result.suggestions),
          metrics: JSON.stringify(metrics),
          health_score: result.healthScore,
          model: result.model,
          error: null,
          updated_at: db.fn.now(),
        });
    },

    async markFailed(id: string, message: string): Promise<void> {
      await db("project_ai_insights")
        .where({ id })
        .update({
          status: "failed",
          error: message,
          updated_at: db.fn.now(),
        });
    },
  };
}

export type PandaAiRepository = ReturnType<typeof pandaAiRepository>;
