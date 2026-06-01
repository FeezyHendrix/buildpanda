import type { FastifyPluginAsync } from "fastify";
import { assertCanModifyProject } from "../../lib/authorization.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { projectsRepository } from "../projects/repository.ts";
import { risksRepository } from "./repository.ts";
import { risksService, type CreateRiskInput, type EditRiskInput } from "./service.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const riskParams = {
  type: "object",
  required: ["id", "riskId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    riskId: { type: "string", minLength: 1 },
  },
} as const;

const severitySchema = { type: "string", enum: ["Low", "Medium", "High"] } as const;

const createRiskBody = {
  type: "object",
  required: ["title", "description", "severity"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", minLength: 1, maxLength: 2000 },
    severity: severitySchema,
  },
} as const;

const editRiskBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", minLength: 1, maxLength: 2000 },
    severity: severitySchema,
  },
} as const;

const riskRoutes: FastifyPluginAsync = async (fastify) => {
  const projects = projectsRepository(fastify.db);
  const service = risksService(risksRepository(fastify.db));

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/risk-factors",
    { schema: { params: projectIdParams } },
    async (request) => {
      request.requireAuth();
      return service.listByProject(request.params.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateRiskInput }>(
    "/projects/:id/risk-factors",
    { schema: { params: projectIdParams, body: createRiskBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const project = await projects.findById(request.params.id);
      if (!project) throw new NotFoundError("Project");
      assertCanModifyProject({ ownerId: project.owner_id, organizationId: project.organization_id }, { userId: user.id, orgRoles: request.orgRoles });

      const risk = await service.create(project.id, request.body);
      return reply.status(201).send(risk);
    },
  );

  fastify.put<{
    Params: { id: string; riskId: string };
    Body: EditRiskInput;
  }>(
    "/projects/:id/risk-factors/:riskId",
    { schema: { params: riskParams, body: editRiskBody } },
    async (request) => {
      const user = request.requireAuth();
      const project = await projects.findById(request.params.id);
      if (!project) throw new NotFoundError("Project");
      assertCanModifyProject({ ownerId: project.owner_id, organizationId: project.organization_id }, { userId: user.id, orgRoles: request.orgRoles });

      return service.edit(project.id, request.params.riskId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; riskId: string } }>(
    "/projects/:id/risk-factors/:riskId",
    { schema: { params: riskParams } },
    async (request, reply) => {
      const user = request.requireAuth();
      const project = await projects.findById(request.params.id);
      if (!project) throw new NotFoundError("Project");
      assertCanModifyProject({ ownerId: project.owner_id, organizationId: project.organization_id }, { userId: user.id, orgRoles: request.orgRoles });

      await service.remove(project.id, request.params.riskId);
      return reply.status(204).send();
    },
  );
};

export default riskRoutes;
