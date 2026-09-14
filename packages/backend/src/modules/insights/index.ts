import type { Knex } from "knex";
import type { FastifyPluginAsync } from "fastify";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

function num(row: { count?: string } | { sum?: string } | undefined, key: "count" | "sum"): number {
  const v = (row as Record<string, string | undefined> | undefined)?.[key];
  return Number(v ?? 0);
}

const insightsRoutes: FastifyPluginAsync = async (fastify) => {
  const db: Knex = fastify.db;

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/insights",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "project", "view");
      const id = project.id;

      const [
        stageAgg,
        pendingApprovals,
        finance,
        approvedChangeCost,
        approvedChangeDays,
        permitsAtRisk,
        missedKeyDates,
      ] = await Promise.all([
        db("project_phases")
          .where({ project_id: id })
          .select(db.raw("COUNT(*)::text as count"), db.raw("COALESCE(AVG(progress_percent),0)::int as avg"), db.raw("COUNT(*) FILTER (WHERE status = 'Done')::text as done"))
          .first<{ count: string; avg: number; done: string }>(),
        db("approvals").where({ project_id: id, kind: "client" }).whereIn("status", ["Pending", "Resubmit"]).count<{ count: string }[]>("id as count").first(),
        db("project_finances").where({ project_id: id }).first(),
        db("change_requests").where({ project_id: id, status: "Approved" }).sum<{ sum: string }[]>("cost_impact as sum").first(),
        db("change_requests").where({ project_id: id, status: "Approved" }).sum<{ sum: string }[]>("time_impact_days as sum").first(),
        db("permits").where({ project_id: id }).whereIn("status", ["NotStarted", "Applied", "Rejected", "Expired"]).count<{ count: string }[]>("id as count").first(),
        db("key_dates").where({ project_id: id, status: "Missed" }).count<{ count: string }[]>("id as count").first(),
      ]);

      const stagesTotal = num(stageAgg, "count");
      const stagesDone = Number(stageAgg?.done ?? 0);

      return {
        progress: {
          stagesTotal,
          stagesComplete: stagesDone,
          overallPercent: stageAgg?.avg ?? 0,
        },
        openItems: {
          awaitingApproval: num(pendingApprovals, "count"),
        },
        budget: {
          currency: (finance as { currency?: string } | undefined)?.currency ?? "NGN",
          total: Number((finance as { total_budget?: string } | undefined)?.total_budget ?? 0),
          released: Number((finance as { amount_paid_to_date?: string } | undefined)?.amount_paid_to_date ?? 0),
          remaining: Number((finance as { total_budget?: string } | undefined)?.total_budget ?? 0) - Number((finance as { amount_paid_to_date?: string } | undefined)?.amount_paid_to_date ?? 0),
          approvedChangeCost: num(approvedChangeCost, "sum"),
        },
        scheduleRisk: {
          approvedChangeDays: num(approvedChangeDays, "sum"),
          permitsAtRisk: num(permitsAtRisk, "count"),
          missedKeyDates: num(missedKeyDates, "count"),
        },
      };
    },
  );
};

export default insightsRoutes;
