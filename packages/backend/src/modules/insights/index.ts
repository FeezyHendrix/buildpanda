import type { Knex } from "knex";
import type { FastifyPluginAsync } from "fastify";
import { projectsRepository } from "../projects/repository.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const whatsNextQuery = {
  type: "object",
  additionalProperties: false,
  properties: { days: { type: "integer", minimum: 1, maximum: 90 } },
} as const;

function num(row: { count?: string } | { sum?: string } | undefined, key: "count" | "sum"): number {
  const v = (row as Record<string, string | undefined> | undefined)?.[key];
  return Number(v ?? 0);
}

function isoDateOffset(baseIso: string, days: number): string {
  // baseIso is "YYYY-MM-DDT..."; add days to the date part only.
  const [y, m, d] = baseIso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m! - 1), d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
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
        openIssues,
        blockedIssues,
        openQueries,
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
        db("action_items").where({ project_id: id }).whereNot("status", "Resolved").count<{ count: string }[]>("id as count").first(),
        db("action_items").where({ project_id: id, status: "Blocked" }).count<{ count: string }[]>("id as count").first(),
        db("queries").where({ project_id: id, status: "Open" }).count<{ count: string }[]>("id as count").first(),
        db("approvals").where({ project_id: id }).whereIn("status", ["Pending", "Resubmit"]).count<{ count: string }[]>("id as count").first(),
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
          actionItems: num(openIssues, "count"),
          blocked: num(blockedIssues, "count"),
          queries: num(openQueries, "count"),
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
          blockedItems: num(blockedIssues, "count"),
        },
      };
    },
  );

  fastify.get<{ Params: { id: string }; Querystring: { days?: number } }>(
    "/projects/:id/whats-next",
    { schema: { params: projectIdParams, querystring: whatsNextQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "project", "view");
      const id = project.id;
      const days = request.query.days ?? 14;
      const nowIso = new Date().toISOString();
      const today = nowIso.slice(0, 10);
      const cutoff = isoDateOffset(nowIso, days);

      const [inProgressStages, upcomingStages, dueActionItems, dueQueries, dueApprovals, upcomingKeyDates, expiringPermits] =
        await Promise.all([
          db("project_phases").where({ project_id: id, status: "InProgress" }).select("id", "name", "progress_percent", "date_range").orderBy("sort_order", "asc"),
          db("project_phases").where({ project_id: id, status: "Pending" }).whereNotNull("start_date").where("start_date", "<=", cutoff).select("id", "name", "start_date").orderBy("start_date", "asc"),
          db("action_items").where({ project_id: id }).whereNot("status", "Resolved").whereNotNull("due_date").where("due_date", "<=", cutoff).select("id", "title", "priority", "due_date", "status").orderBy("due_date", "asc"),
          db("queries").where({ project_id: id, status: "Open" }).whereNotNull("due_date").where("due_date", "<=", cutoff).select("id", "subject", "due_date").orderBy("due_date", "asc"),
          db("approvals").where({ project_id: id }).whereIn("status", ["Pending", "Resubmit"]).whereNotNull("due_date").where("due_date", "<=", cutoff).select("id", "title", "due_date", "status").orderBy("due_date", "asc"),
          db("key_dates").where({ project_id: id, status: "Upcoming" }).whereNotNull("target_date").where("target_date", "<=", cutoff).select("id", "label", "target_date").orderBy("target_date", "asc"),
          db("permits").where({ project_id: id, status: "Approved" }).whereNotNull("expiry_date").where("expiry_date", "<=", cutoff).select("id", "title", "expiry_date").orderBy("expiry_date", "asc"),
        ]);

      return {
        windowDays: days,
        from: today,
        to: cutoff,
        stagesInProgress: inProgressStages,
        upcomingStages,
        dueActionItems,
        dueQueries,
        dueApprovals,
        upcomingKeyDates,
        expiringPermits,
      };
    },
  );

  fastify.get<{ Querystring: { days?: number } }>(
    "/whats-next",
    { schema: { querystring: whatsNextQuery } },
    async (request) => {
      const user = request.requireAuth();
      const projects = await projectsRepository(db).listForUser(user.id, request.orgRoles);
      const days = request.query.days ?? 14;
      const nowIso = new Date().toISOString();
      const today = nowIso.slice(0, 10);
      const cutoff = isoDateOffset(nowIso, days);

      const empty = {
        windowDays: days,
        from: today,
        to: cutoff,
        dueActionItems: [],
        dueQueries: [],
        dueApprovals: [],
        upcomingKeyDates: [],
        expiringPermits: [],
      };
      if (projects.length === 0) return empty;

      const projectIds = projects.map((p) => p.id);
      const nameById = new Map(projects.map((p) => [p.id, p.name]));
      const tag = <T extends { project_id: string }>(rows: T[]) =>
        rows.map((r) => ({ ...r, projectName: nameById.get(r.project_id) ?? "" }));

      const [dueActionItems, dueQueries, dueApprovals, upcomingKeyDates, expiringPermits] =
        await Promise.all([
          db("action_items")
            .whereIn("project_id", projectIds)
            .whereNot("status", "Resolved")
            .whereNotNull("due_date")
            .where("due_date", "<=", cutoff)
            .select("id", "project_id", "title", "priority", "due_date", "status")
            .orderBy("due_date", "asc"),
          db("queries")
            .whereIn("project_id", projectIds)
            .where("status", "Open")
            .whereNotNull("due_date")
            .where("due_date", "<=", cutoff)
            .select("id", "project_id", "subject", "due_date")
            .orderBy("due_date", "asc"),
          db("approvals")
            .whereIn("project_id", projectIds)
            .whereIn("status", ["Pending", "Resubmit"])
            .whereNotNull("due_date")
            .where("due_date", "<=", cutoff)
            .select("id", "project_id", "title", "due_date", "status")
            .orderBy("due_date", "asc"),
          db("key_dates")
            .whereIn("project_id", projectIds)
            .where("status", "Upcoming")
            .whereNotNull("target_date")
            .where("target_date", "<=", cutoff)
            .select("id", "project_id", "label", "target_date")
            .orderBy("target_date", "asc"),
          db("permits")
            .whereIn("project_id", projectIds)
            .where("status", "Approved")
            .whereNotNull("expiry_date")
            .where("expiry_date", "<=", cutoff)
            .select("id", "project_id", "title", "expiry_date")
            .orderBy("expiry_date", "asc"),
        ]);

      return {
        windowDays: days,
        from: today,
        to: cutoff,
        dueActionItems: tag(dueActionItems),
        dueQueries: tag(dueQueries),
        dueApprovals: tag(dueApprovals),
        upcomingKeyDates: tag(upcomingKeyDates),
        expiringPermits: tag(expiringPermits),
      };
    },
  );
};

export default insightsRoutes;
