import type { FastifyPluginAsync } from "fastify";
import { projectsRepository } from "./repository.ts";
import { projectsService } from "./service.ts";
import type { CreateProjectInput } from "./types.ts";

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
        currency: { type: "string", enum: ["NGN", "USD"] },
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

const projectRoutes: FastifyPluginAsync = async (fastify) => {
  const service = projectsService(projectsRepository(fastify.db));

  fastify.get("/projects", async (request) => {
    const user = request.requireAuth();
    return service.listForOwner(user.id);
  });

  fastify.post<{ Body: CreateProjectInput }>(
    "/projects",
    { schema: { body: createProjectBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const project = await service.create(request.body, user.id);
      return reply.status(201).send(project);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id",
    { schema: { params: projectIdParams } },
    async (request) => {
      request.requireAuth();
      return service.getById(request.params.id);
    },
  );
};

export default projectRoutes;
