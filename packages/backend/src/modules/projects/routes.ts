import type { FastifyPluginAsync } from "fastify";
import { currencyCodeSchema, type CurrencyCode } from "../../lib/currencies.ts";
import { projectsRepository } from "./repository.ts";
import { projectsService } from "./service.ts";
import type { CreateProjectInput, UpdateProjectBudgetInput } from "./types.ts";

const updateCurrencyBody = {
  type: "object",
  required: ["currency"],
  additionalProperties: false,
  properties: {
    currency: currencyCodeSchema,
  },
} as const;

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const createProjectBody = {
  type: "object",
  required: ["title", "projectType", "location", "details", "management"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    projectType: { type: "string", minLength: 1, maxLength: 100 },
    location: {
      type: "object",
      required: ["state", "city", "ownsLand"],
      additionalProperties: false,
      properties: {
        state: { type: "string", minLength: 1, maxLength: 100 },
        city: { type: "string", minLength: 1, maxLength: 100 },
        ownsLand: { type: "boolean" },
      },
    },
    details: {
      type: "object",
      required: [
        "buildingType",
        "currency",
        "budgetMin",
        "budgetMax",
        "timeline",
        "fundingMethod",
      ],
      additionalProperties: false,
      properties: {
        buildingType: { type: "string", minLength: 1, maxLength: 100 },
        currency: currencyCodeSchema,
        budgetMin: { type: "number", minimum: 0 },
        budgetMax: { type: "number", minimum: 0 },
        timeline: { type: "string", minLength: 1, maxLength: 100 },
        fundingMethod: { type: "string", minLength: 1, maxLength: 100 },
      },
    },
    management: {
      type: "object",
      required: ["involvementLevel", "riskOptions"],
      additionalProperties: false,
      properties: {
        involvementLevel: { type: "string", minLength: 1, maxLength: 100 },
        riskOptions: {
          type: "array",
          items: { type: "string", minLength: 1, maxLength: 100 },
          maxItems: 20,
        },
      },
    },
  },
} as const;

const updateBudgetBody = {
  type: "object",
  required: ["budgetMin", "budgetMax"],
  additionalProperties: false,
  properties: {
    budgetMin: { type: "number", minimum: 0 },
    budgetMax: { type: "number", minimum: 0 },
    currency: currencyCodeSchema,
  },
} as const;

const projectRoutes: FastifyPluginAsync = async (fastify) => {
  const service = projectsService(projectsRepository(fastify.db));

  fastify.get("/projects", async (request) => {
    const user = request.requireAuth();
    return service.listForOwner(user.id, [...request.orgRoles.keys()]);
  });

  fastify.post<{ Body: CreateProjectInput }>(
    "/projects",
    { schema: { body: createProjectBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const activeOrg = request.activeOrganizationId;
      const organizationId =
        activeOrg !== null && request.orgRoles.has(activeOrg) ? activeOrg : null;
      // Org projects require create permission; personal projects allow any authenticated user
      if (organizationId !== null) {
        request.requireOrgPermission("project", "create");
      }
      const project = await service.create(request.body, user.id, organizationId);
      return reply.status(201).send(project);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id",
    { schema: { params: projectIdParams } },
    async (request) => {
      const user = request.requireAuth();
      return service.getByIdForUser(request.params.id, {
        userId: user.id,
        orgRoles: request.orgRoles,
      });
    },
  );

  fastify.patch<{ Params: { id: string }; Body: UpdateProjectBudgetInput }>(
    "/projects/:id/budget",
    { schema: { params: projectIdParams, body: updateBudgetBody } },
    async (request) => {
      const user = request.requireAuth();
      return service.updateBudgetForUser(request.params.id, request.body, {
        userId: user.id,
        orgRoles: request.orgRoles,
      });
    },
  );

  fastify.patch<{ Params: { id: string }; Body: { currency: CurrencyCode } }>(
    "/projects/:id/currency",
    { schema: { params: projectIdParams, body: updateCurrencyBody } },
    async (request) => {
      const user = request.requireAuth();
      return service.updateCurrencyForUser(request.params.id, request.body.currency, {
        userId: user.id,
        orgRoles: request.orgRoles,
      });
    },
  );
};

export default projectRoutes;
