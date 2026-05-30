import type { FastifyPluginAsync } from "fastify";
import { assertCanModify } from "../../lib/authorization.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { projectsRepository } from "../projects/repository.ts";
import { inspectionsRepository } from "./repository.ts";
import { inspectionsService, type RequestInspectionInput } from "./service.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const requestInspectionBody = {
  type: "object",
  required: ["title", "category", "description", "scheduledAt"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    category: {
      type: "string",
      enum: [
        "Structural",
        "Quantity Survey",
        "General Progress",
        "Electrical",
        "Plumbing",
      ],
    },
    description: { type: "string", minLength: 1, maxLength: 2000 },
    scheduledAt: { type: "string", minLength: 1, maxLength: 100 },
    inspector: {
      type: "object",
      additionalProperties: false,
      required: ["name", "role"],
      properties: {
        id: { type: "string", minLength: 1, maxLength: 100 },
        name: { type: "string", minLength: 1, maxLength: 200 },
        role: { type: "string", minLength: 1, maxLength: 100 },
      },
    },
  },
} as const;

const inspectionRoutes: FastifyPluginAsync = async (fastify) => {
  const projects = projectsRepository(fastify.db);
  const service = inspectionsService(inspectionsRepository(fastify.db));

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/inspections",
    { schema: { params: projectIdParams } },
    async (request) => {
      request.requireAuth();
      return service.listByProject(request.params.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: RequestInspectionInput }>(
    "/projects/:id/inspections",
    { schema: { params: projectIdParams, body: requestInspectionBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const project = await projects.findById(request.params.id);
      if (!project) throw new NotFoundError("Project");
      assertCanModify({ ownerId: project.owner_id }, user);

      const inspection = await service.request(project.id, request.body);
      return reply.status(201).send(inspection);
    },
  );
};

export default inspectionRoutes;
