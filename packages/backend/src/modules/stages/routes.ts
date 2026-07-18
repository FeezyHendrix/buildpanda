import type { FastifyPluginAsync } from "fastify";
import { buildingsRepository } from "../buildings/repository.ts";
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

const buildingQuery = {
  type: "object",
  additionalProperties: false,
  properties: { buildingId: { type: "string", minLength: 1 } },
} as const;

const STATUS = ["Done", "InProgress", "Pending"] as const;

const createStageBody = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    buildingId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
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
  const buildings = buildingsRepository(fastify.db);
  const service = stagesService(stagesRepository(fastify.db), (projectId) =>
    buildings.soleRealBuildingId(projectId),
  );

  fastify.get<{ Params: { id: string }; Querystring: { buildingId?: string } }>(
    "/projects/:id/stages",
    { schema: { params: projectIdParams, querystring: buildingQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "view");
      return service.list(project.id, request.query.buildingId);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateStageInput }>(
    "/projects/:id/stages",
    { schema: { params: projectIdParams, body: createStageBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "manage");
      const stage = await service.create(project.id, request.body);
      return reply.status(201).send(stage);
    },
  );

  fastify.patch<{ Params: { id: string }; Body: { stageIds: string[] } }>(
    "/projects/:id/stages/reorder",
    { schema: { params: projectIdParams, body: reorderBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "manage");
      return service.reorder(project.id, request.body.stageIds);
    },
  );

  fastify.patch<{ Params: { id: string; stageId: string }; Body: UpdateStageInput }>(
    "/projects/:id/stages/:stageId",
    { schema: { params: stageParams, body: updateStageBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "manage");
      return service.update(project.id, request.params.stageId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; stageId: string } }>(
    "/projects/:id/stages/:stageId",
    { schema: { params: stageParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "manage");
      await service.remove(project.id, request.params.stageId);
      return reply.status(204).send();
    },
  );
};

export default stageRoutes;
