import type { FastifyPluginAsync } from "fastify";
import { idParams as projectIdParams } from "../../lib/schemas.ts";
import { eotRepository } from "./repository.ts";
import { applyApprovedEot, eotService } from "./service.ts";
import { EOT_DECISIONS, EOT_STATUSES } from "./types.ts";
import type {
  CreateEotClaimInput,
  DecideEotClaimInput,
  UpdateEotClaimInput,
} from "./types.ts";

const claimParams = {
  type: "object",
  required: ["id", "claimId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    claimId: { type: "string", minLength: 1 },
  },
} as const;

const delayIdsField = {
  type: "array",
  maxItems: 200,
  items: { type: "string", minLength: 1, maxLength: 100 },
} as const;

const createBody = {
  type: "object",
  required: ["title"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    daysClaimed: { type: "integer", minimum: 0, maximum: 3650 },
    reason: { type: ["string", "null"], maxLength: 8000 },
    delayIds: delayIdsField,
    changeRequestId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    notes: { type: ["string", "null"], maxLength: 8000 },
  },
} as const;

const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    daysClaimed: { type: "integer", minimum: 0, maximum: 3650 },
    reason: { type: ["string", "null"], maxLength: 8000 },
    delayIds: delayIdsField,
    changeRequestId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    notes: { type: ["string", "null"], maxLength: 8000 },
  },
} as const;

const decideBody = {
  type: "object",
  required: ["decision"],
  additionalProperties: false,
  properties: {
    decision: { type: "string", enum: EOT_DECISIONS },
    daysAwarded: { type: "integer", minimum: 0, maximum: 3650 },
    notes: { type: ["string", "null"], maxLength: 8000 },
  },
} as const;

const claimSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    projectId: { type: "string" },
    number: { type: "integer" },
    reference: { type: "string" },
    title: { type: "string" },
    daysClaimed: { type: "integer" },
    daysAwarded: { type: ["integer", "null"] },
    status: { type: "string", enum: EOT_STATUSES },
    reason: { type: ["string", "null"] },
    delayIds: { type: "array", items: { type: "string" } },
    delays: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          activityId: { type: "string" },
          activityName: { type: "string" },
          reasonCode: { type: "string" },
          daysLost: { type: "integer" },
          culpability: { type: "string" },
          eotClaimable: { type: "boolean" },
          startedAt: { type: "string" },
        },
      },
    },
    changeRequestId: { type: ["string", "null"] },
    decidedById: { type: ["string", "null"] },
    decidedAt: { type: ["string", "null"] },
    submittedAt: { type: ["string", "null"] },
    notes: { type: ["string", "null"] },
    createdById: { type: ["string", "null"] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;

const extensionOfTimeRoutes: FastifyPluginAsync = async (fastify) => {
  const service = eotService(eotRepository(fastify.db), {
    applyAward: (projectId, days) =>
      fastify.db.transaction((trx) => applyApprovedEot(projectId, days, trx)),
  });

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/extensions-of-time",
    { schema: { params: projectIdParams, response: { 200: { type: "array", items: claimSchema } } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "view");
      return service.list(project.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateEotClaimInput }>(
    "/projects/:id/extensions-of-time",
    { schema: { params: projectIdParams, body: createBody, response: { 201: claimSchema } } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      const user = request.requireAuth();
      return reply.status(201).send(await service.create(project.id, request.body, user.id));
    },
  );

  fastify.get<{ Params: { id: string; claimId: string } }>(
    "/projects/:id/extensions-of-time/:claimId",
    { schema: { params: claimParams, response: { 200: claimSchema } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "view");
      return service.get(project.id, request.params.claimId);
    },
  );

  fastify.patch<{ Params: { id: string; claimId: string }; Body: UpdateEotClaimInput }>(
    "/projects/:id/extensions-of-time/:claimId",
    { schema: { params: claimParams, body: updateBody, response: { 200: claimSchema } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      return service.update(project.id, request.params.claimId, request.body);
    },
  );

  fastify.post<{ Params: { id: string; claimId: string } }>(
    "/projects/:id/extensions-of-time/:claimId/submit",
    { schema: { params: claimParams, response: { 200: claimSchema } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      return service.submit(project.id, request.params.claimId);
    },
  );

  fastify.post<{ Params: { id: string; claimId: string }; Body: DecideEotClaimInput }>(
    "/projects/:id/extensions-of-time/:claimId/decide",
    { schema: { params: claimParams, body: decideBody, response: { 200: claimSchema } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      const user = request.requireAuth();
      return service.decide(project.id, request.params.claimId, request.body, user.id);
    },
  );
};

export default extensionOfTimeRoutes;
