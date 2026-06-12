import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { adminRepository, type ListParams } from "./repository.ts";
import { NotFoundError } from "../../lib/errors.ts";

const idParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    search: { type: "string", maxLength: 200 },
    status: { type: "string", maxLength: 50 },
    limit: { type: "integer", minimum: 1, maximum: 100 },
    offset: { type: "integer", minimum: 0 },
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

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = adminRepository(fastify.db);

  // Gate every /admin route behind the global admin role.
  fastify.addHook("preHandler", async (request: FastifyRequest) => {
    if (request.url.startsWith("/admin")) {
      request.requireAdmin();
    }
  });

  // Lightweight check used by the admin UI to confirm admin access. Reaching
  // this handler means the gate (and admin-email promotion) already passed.
  fastify.get("/admin/me", async (request) => {
    const user = request.requireAdmin();
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  });

  fastify.get("/admin/overview", async () => repo.overview());

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
};

export default adminRoutes;
