import type { FastifyPluginAsync } from "fastify";
import { buildingsRepository } from "./repository.ts";
import {
  buildingsService,
  type CreateBuildingInput,
  type UpdateBuildingInput,
} from "./service.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const buildingParams = {
  type: "object",
  required: ["id", "buildingId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    buildingId: { type: "string", minLength: 1 },
  },
} as const;

const STATUS = ["planned", "active", "completed", "on_hold"] as const;

const createBuildingBody = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    code: { type: ["string", "null"], maxLength: 40 },
    status: { type: "string", enum: STATUS },
    progressPercent: { type: "integer", minimum: 0, maximum: 100 },
  },
} as const;

const updateBuildingBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    code: { type: ["string", "null"], maxLength: 40 },
    status: { type: "string", enum: STATUS },
    progressPercent: { type: "integer", minimum: 0, maximum: 100 },
  },
} as const;

const reorderBody = {
  type: "object",
  required: ["buildingIds"],
  additionalProperties: false,
  properties: {
    buildingIds: {
      type: "array",
      items: { type: "string", minLength: 1 },
      maxItems: 200,
    },
  },
} as const;

const cloneProgrammeBody = {
  type: "object",
  required: ["fromBuildingId"],
  additionalProperties: false,
  properties: {
    fromBuildingId: { type: "string", minLength: 1 },
  },
} as const;

const buildingRoutes: FastifyPluginAsync = async (fastify) => {
  const service = buildingsService(buildingsRepository(fastify.db));

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/buildings",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "buildings", "view");
      return service.list(project.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateBuildingInput }>(
    "/projects/:id/buildings",
    { schema: { params: projectIdParams, body: createBuildingBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "buildings", "manage");
      const building = await service.create(project.id, request.body);
      return reply.status(201).send(building);
    },
  );

  fastify.patch<{ Params: { id: string }; Body: { buildingIds: string[] } }>(
    "/projects/:id/buildings/reorder",
    { schema: { params: projectIdParams, body: reorderBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "buildings", "manage");
      return service.reorder(project.id, request.body.buildingIds);
    },
  );

  fastify.patch<{ Params: { id: string; buildingId: string }; Body: UpdateBuildingInput }>(
    "/projects/:id/buildings/:buildingId",
    { schema: { params: buildingParams, body: updateBuildingBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "buildings", "manage");
      return service.update(project.id, request.params.buildingId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; buildingId: string } }>(
    "/projects/:id/buildings/:buildingId",
    { schema: { params: buildingParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "buildings", "manage");
      await service.remove(project.id, request.params.buildingId);
      return reply.status(204).send();
    },
  );

  fastify.post<{ Params: { id: string; buildingId: string }; Body: { fromBuildingId: string } }>(
    "/projects/:id/buildings/:buildingId/clone-programme",
    { schema: { params: buildingParams, body: cloneProgrammeBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "buildings", "manage");
      const result = await service.cloneProgramme(
        project.id,
        request.params.buildingId,
        request.body.fromBuildingId,
      );
      return reply.status(201).send(result);
    },
  );
};

export default buildingRoutes;
