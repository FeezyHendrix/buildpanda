import type { FastifyPluginAsync } from "fastify";
import { assertCanAccessProject, assertCanModifyProject } from "../../lib/authorization.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { projectsRepository } from "../projects/repository.ts";
import { stagesRepository } from "./repository.ts";
import {
  stagesService,
  type CreateStageInput,
  type UpdateStageInput,
} from "./service.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const stageParams = {
  type: "object",
  required: ["id", "stageId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    stageId: { type: "string", minLength: 1 },
  },
} as const;

const STATUS = ["Done", "InProgress", "Pending"] as const;

const createStageBody = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    status: { type: "string", enum: STATUS },
    startDate: { type: ["string", "null"], maxLength: 40 },
    endDate: { type: ["string", "null"], maxLength: 40 },
    progressPercent: { type: "integer", minimum: 0, maximum: 100 },
  },
} as const;

const updateStageBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    status: { type: "string", enum: STATUS },
    startDate: { type: ["string", "null"], maxLength: 40 },
    endDate: { type: ["string", "null"], maxLength: 40 },
    progressPercent: { type: "integer", minimum: 0, maximum: 100 },
  },
} as const;

const reorderBody = {
  type: "object",
  required: ["stageIds"],
  additionalProperties: false,
  properties: {
    stageIds: {
      type: "array",
      items: { type: "string", minLength: 1 },
      maxItems: 200,
    },
  },
} as const;

const stageRoutes: FastifyPluginAsync = async (fastify) => {
  const projects = projectsRepository(fastify.db);
  const service = stagesService(stagesRepository(fastify.db));

  async function loadProject(id: string) {
    const project = await projects.findById(id);
    if (!project) throw new NotFoundError("Project");
    return project;
  }

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/stages",
    { schema: { params: projectIdParams } },
    async (request) => {
      const user = request.requireAuth();
      const project = await loadProject(request.params.id);
      assertCanAccessProject(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles },
      );
      return service.list(project.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateStageInput }>(
    "/projects/:id/stages",
    { schema: { params: projectIdParams, body: createStageBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const project = await loadProject(request.params.id);
      assertCanModifyProject(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles },
      );
      const stage = await service.create(project.id, request.body);
      return reply.status(201).send(stage);
    },
  );

  fastify.patch<{ Params: { id: string }; Body: { stageIds: string[] } }>(
    "/projects/:id/stages/reorder",
    { schema: { params: projectIdParams, body: reorderBody } },
    async (request) => {
      const user = request.requireAuth();
      const project = await loadProject(request.params.id);
      assertCanModifyProject(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles },
      );
      return service.reorder(project.id, request.body.stageIds);
    },
  );

  fastify.patch<{ Params: { id: string; stageId: string }; Body: UpdateStageInput }>(
    "/projects/:id/stages/:stageId",
    { schema: { params: stageParams, body: updateStageBody } },
    async (request) => {
      const user = request.requireAuth();
      const project = await loadProject(request.params.id);
      assertCanModifyProject(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles },
      );
      return service.update(project.id, request.params.stageId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; stageId: string } }>(
    "/projects/:id/stages/:stageId",
    { schema: { params: stageParams } },
    async (request, reply) => {
      const user = request.requireAuth();
      const project = await loadProject(request.params.id);
      assertCanModifyProject(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles },
      );
      await service.remove(project.id, request.params.stageId);
      return reply.status(204).send();
    },
  );
};

export default stageRoutes;
