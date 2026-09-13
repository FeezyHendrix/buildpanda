import type { FastifyPluginAsync } from "fastify";
import { BadRequestError } from "../../lib/errors.ts";
import { idParams as projectIdParams, buildingQuery } from "../../lib/schemas.ts";
import { buildingsRepository } from "../buildings/repository.ts";
import { keyDatesRepository } from "./repository.ts";
import { keyDatesService } from "./service.ts";
import { KEY_DATE_STATUSES, type KeyDateInput } from "./types.ts";

const kdParams = {
  type: "object",
  required: ["id", "keyDateId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    keyDateId: { type: "string", minLength: 1 },
  },
} as const;

const bodyProps = {
  label: { type: "string", minLength: 1, maxLength: 200 },
  buildingId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
  targetDate: { type: ["string", "null"], maxLength: 40 },
  actualDate: { type: ["string", "null"], maxLength: 40 },
  status: { type: "string", enum: KEY_DATE_STATUSES },
  notes: { type: ["string", "null"], maxLength: 2000 },
  linkedActivityId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
  isContractual: { type: "boolean" },
} as const;

const createBody = {
  type: "object",
  required: ["label"],
  additionalProperties: false,
  properties: bodyProps,
} as const;

const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: bodyProps,
} as const;

const keyDateSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    projectId: { type: "string" },
    label: { type: "string" },
    targetDate: { type: ["string", "null"] },
    actualDate: { type: ["string", "null"] },
    status: { type: "string", enum: KEY_DATE_STATUSES },
    notes: { type: ["string", "null"] },
    linkedActivityId: { type: ["string", "null"] },
    isContractual: { type: "boolean" },
    revisedFrom: { type: ["string", "null"] },
    sortOrder: { type: "integer" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;

const keyDateRoutes: FastifyPluginAsync = async (fastify) => {
  const buildings = buildingsRepository(fastify.db);
  const service = keyDatesService(keyDatesRepository(fastify.db), async (projectId, explicit) => {
    if (explicit) return explicit;
    const buildingId = await buildings.soleRealBuildingId(projectId);
    if (!buildingId) throw new BadRequestError("buildingId is required for a multi-building project");
    return buildingId;
  });

  fastify.get<{ Params: { id: string }; Querystring: { buildingId?: string } }>(
    "/projects/:id/key-dates",
    {
      schema: {
        params: projectIdParams,
        querystring: buildingQuery,
        response: { 200: { type: "array", items: keyDateSchema } },
      },
    },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "key-dates", "view");
      return service.list(project.id, request.query.buildingId);
    },
  );

  fastify.post<{ Params: { id: string }; Body: KeyDateInput }>(
    "/projects/:id/key-dates",
    { schema: { params: projectIdParams, body: createBody, response: { 201: keyDateSchema } } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "key-dates", "manage");
      return reply.status(201).send(await service.create(project.id, request.body));
    },
  );

  fastify.patch<{ Params: { id: string; keyDateId: string }; Body: KeyDateInput }>(
    "/projects/:id/key-dates/:keyDateId",
    { schema: { params: kdParams, body: updateBody, response: { 200: keyDateSchema } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "key-dates", "manage");
      return service.update(project.id, request.params.keyDateId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; keyDateId: string } }>(
    "/projects/:id/key-dates/:keyDateId",
    { schema: { params: kdParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "key-dates", "manage");
      await service.remove(project.id, request.params.keyDateId);
      return reply.status(204).send();
    },
  );
};

export default keyDateRoutes;
