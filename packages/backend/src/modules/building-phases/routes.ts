import type { FastifyPluginAsync } from "fastify";
import { buildingsRepository } from "../buildings/repository.ts";
import { stagesRepository } from "../stages/repository.ts";
import { buildingPhasesRepository } from "./repository.ts";
import { buildingPhasesService } from "./service.ts";
import {
  BUILDING_PHASE_STATUSES,
  type CreateBuildingPhaseBody,
  type UpdateBuildingPhaseBody,
} from "./types.ts";

const projectParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

const phaseParams = {
  type: "object",
  required: ["id", "phaseId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    phaseId: { type: "string", minLength: 1 },
  },
} as const;

const buildingQuery = {
  type: "object",
  additionalProperties: false,
  properties: { buildingId: { type: "string", minLength: 1 } },
} as const;

// The service trims and enforces 1 to 80; this only bounds the raw input.
const nameField = { type: "string", minLength: 1, maxLength: 200 } as const;

const createBody = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: {
    name: nameField,
    buildingId: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

const updateBody = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: { name: nameField },
} as const;

const phaseSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    projectId: { type: "string" },
    buildingId: { type: "string" },
    name: { type: "string" },
    sortOrder: { type: "integer" },
    stageCount: { type: "integer" },
    progressPercent: { type: "integer" },
    status: { type: "string", enum: BUILDING_PHASE_STATUSES },
  },
} as const;

// Same resource/action pairs as the stages routes: a phase is how stages are grouped.
const buildingPhaseRoutes: FastifyPluginAsync = async (fastify) => {
  const buildings = buildingsRepository(fastify.db);
  const stages = stagesRepository(fastify.db);
  const service = buildingPhasesService(buildingPhasesRepository(fastify.db), {
    stagesForProject: (projectId) => stages.listByProject(projectId),
    soleRealBuildingId: (projectId) => buildings.soleRealBuildingId(projectId),
    buildingBelongsToProject: async (projectId, buildingId) =>
      (await buildings.findById(buildingId))?.project_id === projectId,
  });

  fastify.get<{ Params: { id: string }; Querystring: { buildingId?: string } }>(
    "/projects/:id/building-phases",
    {
      schema: {
        params: projectParams,
        querystring: buildingQuery,
        response: { 200: { type: "array", items: phaseSchema } },
      },
    },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "view");
      return service.list(project.id, request.query.buildingId);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateBuildingPhaseBody }>(
    "/projects/:id/building-phases",
    { schema: { params: projectParams, body: createBody, response: { 201: phaseSchema } } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "manage");
      const phase = await service.create(project.id, request.requireAuth().id, request.body);
      return reply.status(201).send(phase);
    },
  );

  fastify.patch<{ Params: { id: string; phaseId: string }; Body: UpdateBuildingPhaseBody }>(
    "/projects/:id/building-phases/:phaseId",
    { schema: { params: phaseParams, body: updateBody, response: { 200: phaseSchema } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "manage");
      return service.rename(project.id, request.params.phaseId, request.body.name);
    },
  );

  fastify.delete<{ Params: { id: string; phaseId: string } }>(
    "/projects/:id/building-phases/:phaseId",
    { schema: { params: phaseParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "manage");
      await service.remove(project.id, request.params.phaseId);
      return reply.status(204).send();
    },
  );
};

export default buildingPhaseRoutes;
