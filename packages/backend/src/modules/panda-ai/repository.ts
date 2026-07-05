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

const CREATED_AT_INPUT_TABLES = [
  "project_updates",
  "project_invoices",
  "project_budget_categories",
  "project_budget_periods",
  "change_requests",
  "risk_factors",
  "action_items",
  "queries",
  "approvals",
  "daily_logs",
  "inspections",
  "key_dates",
  "activities",
  "permits",
] as const;

const UPDATED_AT_INPUT_TABLES = [
  "change_requests",
  "action_items",
  "queries",
  "approvals",
  "daily_logs",
  "key_dates",
  "activities",
  "permits",
] as const;

const HEALTH_RETENTION_LIMIT = 30;

export function pandaAiRepository(db: Knex) {
  async function lastInputChangeAt(
    projectId: string,
  ): Promise<Date | null> {
    const reads = [
      ...CREATED_AT_INPUT_TABLES.map((table) =>
        db(table)
          .where({ project_id: projectId })
          .max<{ at: Date | null }>("created_at as at")
          .first(),
      ),
      ...UPDATED_AT_INPUT_TABLES.map((table) =>
        db(table)
          .where({ project_id: projectId })
          .max<{ at: Date | null }>("updated_at as at")
          .first(),
      ),
      db("invoice_payments")
        .join(
          "project_invoices",
          "invoice_payments.invoice_id",
          "project_invoices.id",
        )
        .where("project_invoices.project_id", projectId)
        .max<{ at: Date | null }>("invoice_payments.created_at as at")
        .first(),
    ];
    const results = await Promise.all(reads);
    let latest: number | null = null;
    for (const row of results) {
      const value = row?.at ? new Date(row.at).getTime() : null;
      if (value !== null && (latest === null || value > latest)) {
        latest = value;
      }
    }
    return latest === null ? null : new Date(latest);
  }

  return {
    lastInputChangeAt,

    async listProjectIds(): Promise<string[]> {
      const rows = await db("projects").select("id");
      return rows.map((r: { id: string }) => r.id);
    },

    async hasUnanalyzedChanges(projectId: string): Promise<boolean> {
      const latestInsight = await db("project_ai_insights")
        .where({ project_id: projectId })
        .max<{ at: Date | null }>("created_at as at")
        .first();
      if (!latestInsight?.at) return true;
      const changedAt = await lastInputChangeAt(projectId);
      if (!changedAt) return false;
      return changedAt.getTime() > new Date(latestInsight.at).getTime();
    },

    async pruneInsights(projectId: string): Promise<number> {
      const keep = await db("project_ai_insights")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc")
        .limit(HEALTH_RETENTION_LIMIT)
        .pluck<string[]>("id");
      if (keep.length < HEALTH_RETENTION_LIMIT) return 0;
      return db("project_ai_insights")
        .where({ project_id: projectId })
        .whereNotIn("id", keep)
        .delete();
    },

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
