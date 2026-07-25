import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { adminRepository, type ListParams } from "./repository.ts";
import { adminAuditRepository } from "./audit-repository.ts";
import {
  adminMetricsRepository,
  priorRange,
  deltaPct,
  funnelConversions,
  type MetricRange,
} from "./metrics-repository.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { idParams, paginationProperties } from "../../lib/schemas.ts";

const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    search: { type: "string", maxLength: 200 },
    status: { type: "string", maxLength: 50 },
    ...paginationProperties,
  },
} as const;

const updateUserBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    role: { type: "string", enum: ["admin", "user"] },
    banned: { type: "boolean" },
    banReason: { type: "string", maxLength: 500 },
  },
} as const;

interface ListQuery {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

function toListParams(query: ListQuery): ListParams {
  return {
    search: query.search?.trim() || undefined,
    status: query.status?.trim() || undefined,
    limit: query.limit ?? 25,
    offset: query.offset ?? 0,
  };
}

const rangeQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    from: { type: "string", maxLength: 40 },
    to: { type: "string", maxLength: 40 },
  },
} as const;

function toRange(query: { from?: string; to?: string }): MetricRange {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}



const adminRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = adminRepository(fastify.db);
  const audit = adminAuditRepository(fastify.db);
  const metrics = adminMetricsRepository(fastify.db);

  // Gate every /admin route behind the global admin role.
  fastify.addHook("preHandler", async (request: FastifyRequest) => {
    if (request.url.startsWith("/admin")) {
      request.requireAdmin();
    }
  });

  // Fire-and-forget audit of every admin read + write. done() first so the
  // insert never adds latency to the response.
  fastify.addHook("onResponse", (request, reply, done) => {
    done();
    const path = request.url.split("?")[0] ?? request.url;
    if (!path.startsWith("/admin") || request.user?.role !== "admin") return;
    const cfg = request.routeOptions?.config ?? {};
    if (cfg.audit === false) return;
    const params = (request.params ?? {}) as Record<string, string>;
    const targetId = cfg.auditTargetParam ? params[cfg.auditTargetParam] : (params["id"] ?? null);
    const route = request.routeOptions?.url ?? null;
    void audit
      .insert({
        adminUserId: request.user.id,
        action: cfg.auditAction ?? `${request.method} ${route ?? path}`,
        targetType: cfg.auditTargetType ?? null,
        targetId: targetId ?? null,
        method: request.method,
        path,
        route,
        ip: request.ip ?? null,
        statusCode: reply.statusCode,
        metadata: Object.keys(params).length > 0 ? { params } : null,
      })
      .catch((err) => fastify.log.warn({ err }, "admin_audit_log insert failed"));
  });

  // Lightweight check used by the admin UI to confirm admin access. Reaching
  // this handler means the gate (and admin-email promotion) already passed.
  fastify.get("/admin/me", async (request) => {
    const user = request.requireAdmin();
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  });

  fastify.get("/admin/overview", async () => repo.overview());

  fastify.get<{ Querystring: { from?: string; to?: string } }>(
    "/admin/metrics/overview",
    { schema: { querystring: rangeQuery } },
    async (request) => {
      const range = toRange(request.query);
      const prior = priorRange(range);
      const dayMs = 24 * 60 * 60 * 1000;
      const now = new Date();
      const [
        signups,
        signupsPrior,
        signupSeries,
        activeSeries,
        wau,
        mau,
        dau,
        tokenSeries,
        jobHealth,
        value,
      ] = await Promise.all([
        metrics.totalSignups(range),
        metrics.totalSignups(prior),
        metrics.signupSeries(range),
        metrics.activeUserSeries(range),
        metrics.activeUsers(new Date(now.getTime() - 7 * dayMs), now),
        metrics.activeUsers(new Date(now.getTime() - 30 * dayMs), now),
        metrics.activeUsers(new Date(now.getTime() - dayMs), now),
        metrics.aiTokenSeries(range),
        metrics.aiJobHealth(range),
        metrics.valueTracked(),
      ]);
      const totalTokens = tokenSeries.reduce((s, p) => s + p.tokensIn + p.tokensOut, 0);
      const totalCost = tokenSeries.reduce((s, p) => s + p.costUsd, 0);
      const jobTotals = jobHealth.reduce(
        (acc, j) => ({ total: acc.total + j.total, completed: acc.completed + j.completed }),
        { total: 0, completed: 0 },
      );
      return {
        asOf: new Date().toISOString(),
        range: { from: range.from.toISOString(), to: range.to.toISOString() },
        signups: { value: signups, deltaPct: deltaPct(signups, signupsPrior), series: signupSeries },
        activeUsers: { dau, wau, mau, stickiness: mau > 0 ? (dau / mau) * 100 : 0, series: activeSeries },
        aiJobs: {
          total: jobTotals.total,
          successRate: jobTotals.total > 0 ? (jobTotals.completed / jobTotals.total) * 100 : 0,
        },
        aiSpend: { costUsd: totalCost, tokens: totalTokens, series: tokenSeries },
        valueTracked: value,
      };
    },
  );

  fastify.get<{ Querystring: { from?: string; to?: string } }>(
    "/admin/metrics/growth",
    { schema: { querystring: rangeQuery } },
    async (request) => {
      const range = toRange(request.query);
      const [signupSeries, funnelSteps] = await Promise.all([
        metrics.signupSeries(range),
        metrics.activationFunnel(range),
      ]);
      return {
        asOf: new Date().toISOString(),
        signupSeries,
        funnel: funnelConversions(funnelSteps),
      };
    },
  );

  fastify.get<{ Querystring: { from?: string; to?: string } }>(
    "/admin/metrics/engagement",
    { schema: { querystring: rangeQuery } },
    async (request) => {
      const range = toRange(request.query);
      const dayMs = 24 * 60 * 60 * 1000;
      const now = new Date();
      const [activeSeries, dau, wau, mau] = await Promise.all([
        metrics.activeUserSeries(range),
        metrics.activeUsers(new Date(now.getTime() - dayMs), now),
        metrics.activeUsers(new Date(now.getTime() - 7 * dayMs), now),
        metrics.activeUsers(new Date(now.getTime() - 30 * dayMs), now),
      ]);
      return {
        asOf: new Date().toISOString(),
        activeSeries,
        dau,
        wau,
        mau,
        stickiness: mau > 0 ? (dau / mau) * 100 : 0,
      };
    },
  );

  fastify.get<{ Querystring: { from?: string; to?: string } }>(
    "/admin/metrics/ai-ops",
    { schema: { querystring: rangeQuery } },
    async (request) => {
      const range = toRange(request.query);
      const [tokenSeries, costByOrg, jobHealth, uncosted] = await Promise.all([
        metrics.aiTokenSeries(range),
        metrics.aiCostByOrg(range),
        metrics.aiJobHealth(range),
        metrics.uncostedTokens(range),
      ]);
      const totalTokens = tokenSeries.reduce((s, p) => s + p.tokensIn + p.tokensOut, 0);
      const totalCost = tokenSeries.reduce((s, p) => s + p.costUsd, 0);
      return {
        asOf: new Date().toISOString(),
        platform: {
          totalTokens,
          totalCostUsd: totalCost,
          uncostedTokens: uncosted.tokens,
          unpricedModels: uncosted.models,
          series: tokenSeries,
        },
        costByOrg,
        jobHealth,
      };
    },
  );

  // --- Users ---
  fastify.get<{ Querystring: ListQuery }>(
    "/admin/users",
    { schema: { querystring: listQuery } },
    async (request) => repo.listUsers(toListParams(request.query)),
  );

  fastify.get<{ Params: { id: string } }>(
    "/admin/users/:id",
    { schema: { params: idParams } },
    async (request) => {
      const user = await repo.getUser(request.params.id);
      if (!user) throw new NotFoundError("User");
      return user;
    },
  );

  fastify.patch<{ Params: { id: string }; Body: { role?: string; banned?: boolean; banReason?: string } }>(
    "/admin/users/:id",
    { schema: { params: idParams, body: updateUserBody } },
    async (request) => {
      const user = await repo.updateUser(request.params.id, request.body);
      if (!user) throw new NotFoundError("User");
      return user;
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/admin/users/:id",
    { schema: { params: idParams } },
    async (request, reply) => {
      const admin = request.requireAdmin();
      if (admin.id === request.params.id) {
        return reply.status(400).send({ error: "You cannot delete your own account." });
      }
      await repo.deleteUser(request.params.id);
      return reply.status(204).send();
    },
  );

  // --- Organizations ---
  fastify.get<{ Querystring: ListQuery }>(
    "/admin/organizations",
    { schema: { querystring: listQuery } },
    async (request) => repo.listOrganizations(toListParams(request.query)),
  );

  fastify.get<{ Params: { id: string } }>(
    "/admin/organizations/:id",
    { schema: { params: idParams } },
    async (request) => {
      const org = await repo.getOrganization(request.params.id);
      if (!org) throw new NotFoundError("Organization");
      return org;
    },
  );

  // --- Projects ---
  fastify.get<{ Querystring: ListQuery }>(
    "/admin/projects",
    { schema: { querystring: listQuery } },
    async (request) => repo.listProjects(toListParams(request.query)),
  );

  fastify.get<{ Params: { id: string } }>(
    "/admin/projects/:id",
    { schema: { params: idParams } },
    async (request) => {
      const project = await repo.getProject(request.params.id);
      if (!project) throw new NotFoundError("Project");
      return project;
    },
  );

  // --- Leads ---
  fastify.get<{ Querystring: ListQuery }>(
    "/admin/leads",
    { schema: { querystring: listQuery } },
    async (request) => repo.listLeads(toListParams(request.query)),
  );

  fastify.post<{ Params: { id: string }; Body: { organizationId: string } }>(
    "/admin/leads/:id/assign",
    {
      schema: {
        params: idParams,
        body: {
          type: "object",
          required: ["organizationId"],
          additionalProperties: false,
          properties: { organizationId: { type: "string", minLength: 1 } },
        } as const,
      },
    },
    async (request, reply) => {
      const admin = request.requireAdmin();
      const lead = await repo.assignLead(
        request.params.id,
        request.body.organizationId,
        admin.id,
      );
      if (!lead) throw new NotFoundError("Lead or Organization");
      return reply.send(lead);
    },
  );

  fastify.get<{ Querystring: ListQuery }>(
    "/admin/jobs",
    { schema: { querystring: listQuery } },
    async (request) => repo.listImportJobs(toListParams(request.query)),
  );

  fastify.get<{ Params: { kind: string; id: string } }>(
    "/admin/jobs/:kind/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["kind", "id"],
          additionalProperties: false,
          properties: {
            kind: { type: "string", enum: ["programme", "boq"] },
            id: { type: "string", minLength: 1 },
          },
        } as const,
      },
    },
    async (request) => {
      const job = await repo.getImportJob(request.params.kind, request.params.id);
      if (!job) throw new NotFoundError("Import job");
      return job;
    },
  );

  // Read-only drill-down collections for a project.
  fastify.get<{ Params: { id: string } }>(
    "/admin/projects/:id/finances",
    { schema: { params: idParams } },
    async (request) => {
      const id = request.params.id;
      const [summary, budgetPhases, materials, milestones, ledger] = await Promise.all([
        fastify.db("project_finances").where({ project_id: id }).first(),
        repo.projectCollection("budget_phases", id, "sort_order", "asc"),
        repo.projectCollection("material_procurements", id, "sort_order", "asc"),
        repo.projectCollection("milestone_payments", id, "sort_order", "asc"),
        repo.projectCollection("payment_ledger", id, "sort_order", "asc"),
      ]);
      return { summary: summary ?? null, budgetPhases, materials, milestones, ledger };
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/admin/projects/:id/inspections",
    { schema: { params: idParams } },
    async (request) => repo.projectCollection("inspections", request.params.id, "created_at"),
  );

  fastify.get<{ Params: { id: string } }>(
    "/admin/projects/:id/documents",
    { schema: { params: idParams } },
    async (request) => repo.projectCollection("project_documents", request.params.id, "created_at"),
  );

  fastify.get<{ Params: { id: string } }>(
    "/admin/projects/:id/daily-logs",
    { schema: { params: idParams } },
    async (request) => repo.projectCollection("daily_logs", request.params.id, "log_date"),
  );

  fastify.get<{ Params: { id: string } }>(
    "/admin/projects/:id/activities",
    { schema: { params: idParams } },
    async (request) => repo.projectCollection("activities", request.params.id, "planned_start_at"),
  );

  fastify.get<{ Params: { id: string } }>(
    "/admin/projects/:id/updates",
    { schema: { params: idParams } },
    async (request) => repo.projectCollection("project_updates", request.params.id, "created_at"),
  );

  fastify.get<{ Params: { id: string } }>(
    "/admin/projects/:id/risks",
    { schema: { params: idParams } },
    async (request) => repo.projectCollection("risk_factors", request.params.id, "created_at"),
  );

  fastify.get<{
    Querystring: {
      adminUserId?: string;
      action?: string;
      targetType?: string;
      targetId?: string;
      limit?: number;
      offset?: number;
    };
  }>(
    "/admin/audit-log",
    {
      config: { audit: false },
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            adminUserId: { type: "string", maxLength: 100 },
            action: { type: "string", maxLength: 200 },
            targetType: { type: "string", maxLength: 50 },
            targetId: { type: "string", maxLength: 100 },
            ...paginationProperties,
          },
        } as const,
      },
    },
    async (request) =>
      audit.list({
        adminUserId: request.query.adminUserId?.trim() || undefined,
        action: request.query.action?.trim() || undefined,
        targetType: request.query.targetType?.trim() || undefined,
        targetId: request.query.targetId?.trim() || undefined,
        limit: request.query.limit ?? 50,
        offset: request.query.offset ?? 0,
      }),
  );
};

export default adminRoutes;
