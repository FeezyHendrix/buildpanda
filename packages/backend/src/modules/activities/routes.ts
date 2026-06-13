import type { FastifyPluginAsync } from "fastify";
import { activitiesRepository } from "./repository.ts";
import { activitiesService } from "./service.ts";
import type {
  CreateActivityInput,
  RaiseDelayInput,
  ResolveDelayInput,
  UpdateActivityInput,
} from "./types.ts";

const projectIdParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

const activityParams = {
  type: "object",
  required: ["id", "activityId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    activityId: { type: "string", minLength: 1 },
  },
} as const;

const delayParams = {
  type: "object",
  required: ["id", "activityId", "delayId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    activityId: { type: "string", minLength: 1 },
    delayId: { type: "string", minLength: 1 },
  },
} as const;

const isoString = { type: "string", minLength: 1, maxLength: 40 } as const;

const createActivityBody = {
  type: "object",
  required: ["name", "activityType", "plannedStartAt", "plannedEndAt"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    activityType: { type: "string", minLength: 1, maxLength: 100 },
    phaseId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    location: { type: "string", minLength: 1, maxLength: 200 },
    plannedStartAt: isoString,
    plannedEndAt: isoString,
    workerCountPlanned: { type: "integer", minimum: 0, maximum: 5000 },
    notes: { type: "string", maxLength: 2000 },
  },
} as const;

const updateActivityBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    activityType: { type: "string", minLength: 1, maxLength: 100 },
    phaseId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    location: { type: ["string", "null"], minLength: 1, maxLength: 200 },
    status: { type: "string", enum: ["Planned", "InProgress", "Completed", "Cancelled"] },
    plannedStartAt: isoString,
    plannedEndAt: isoString,
    actualStartAt: { type: ["string", "null"], minLength: 1, maxLength: 40 },
    actualEndAt: { type: ["string", "null"], minLength: 1, maxLength: 40 },
    workerCountPlanned: { type: "integer", minimum: 0, maximum: 5000 },
    notes: { type: ["string", "null"], maxLength: 2000 },
  },
} as const;

const raiseDelayBody = {
  type: "object",
  required: ["reasonCode", "startedAt"],
  additionalProperties: false,
  properties: {
    reasonCode: { type: "string", minLength: 1, maxLength: 50 },
    description: { type: "string", maxLength: 2000 },
    startedAt: isoString,
    costImpact: { type: "number", minimum: 0 },
    currency: { type: "string", enum: ["NGN", "USD"] },
    preventionNotes: { type: "string", maxLength: 2000 },
  },
} as const;

const resolveDelayBody = {
  type: "object",
  required: ["resolvedAt"],
  additionalProperties: false,
  properties: {
    resolvedAt: isoString,
    preventionNotes: { type: "string", maxLength: 2000 },
  },
} as const;

const activityRoutes: FastifyPluginAsync = async (fastify) => {
  const service = activitiesService(activitiesRepository(fastify.db));

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/activities",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.listByProject(project.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateActivityInput }>(
    "/projects/:id/activities",
    { schema: { params: projectIdParams, body: createActivityBody } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      const activity = await service.create(project.id, request.body, {
        id: user.id,
        name: user.name,
      });
      return reply.status(201).send(activity);
    },
  );

  fastify.get<{ Params: { id: string; activityId: string } }>(
    "/projects/:id/activities/:activityId",
    { schema: { params: activityParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.getById(project.id, request.params.activityId);
    },
  );

  fastify.patch<{
    Params: { id: string; activityId: string };
    Body: UpdateActivityInput;
  }>(
    "/projects/:id/activities/:activityId",
    { schema: { params: activityParams, body: updateActivityBody } },
    async (request) => {
      const project = await request.requireProjectWrite(request.params.id);
      return service.update(project.id, request.params.activityId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; activityId: string } }>(
    "/projects/:id/activities/:activityId",
    { schema: { params: activityParams } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      await service.remove(project.id, request.params.activityId);
      return reply.status(204).send();
    },
  );

  fastify.post<{
    Params: { id: string; activityId: string };
    Body: RaiseDelayInput;
  }>(
    "/projects/:id/activities/:activityId/delays",
    { schema: { params: activityParams, body: raiseDelayBody } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      const delay = await service.raiseDelay(
        project.id,
        request.params.activityId,
        request.body,
        { id: user.id, name: user.name },
      );
      return reply.status(201).send(delay);
    },
  );

  fastify.patch<{
    Params: { id: string; activityId: string; delayId: string };
    Body: ResolveDelayInput;
  }>(
    "/projects/:id/activities/:activityId/delays/:delayId",
    { schema: { params: delayParams, body: resolveDelayBody } },
    async (request) => {
      const project = await request.requireProjectWrite(request.params.id);
      return service.resolveDelay(
        project.id,
        request.params.activityId,
        request.params.delayId,
        request.body,
      );
    },
  );

  fastify.get("/delay-reasons", async (request) => {
    request.requireAuth();
    return service.listReasons();
  });
};

export default activityRoutes;
