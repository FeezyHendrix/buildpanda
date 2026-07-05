import type { FastifyPluginAsync } from "fastify";
import { lookAheadsRepository } from "./repository.ts";
import { lookAheadsService } from "./service.ts";
import { autoWindowService } from "./auto-window.ts";
import { LOOK_AHEAD_STATUSES } from "./types.ts";
import type {
  CreateLookAheadInput,
  LookAheadStatus,
  LookAheadTimeline,
  UpdateLookAheadInput,
} from "./types.ts";

const projectIdParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

const lookAheadParams = {
  type: "object",
  required: ["id", "lookAheadId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    lookAheadId: { type: "string", minLength: 1 },
  },
} as const;

const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: LOOK_AHEAD_STATUSES },
    timeline: { type: "string", enum: ["past", "current", "future"] },
    activityId: { type: "string", maxLength: 100 },
    sort: { type: "string", enum: ["startDate", "endDate", "status"] },
    order: { type: "string", enum: ["asc", "desc"] },
  },
} as const;

const autoWindowQuery = {
  type: "object",
  additionalProperties: false,
  properties: { weeks: { type: "integer", minimum: 1, maximum: 12 } },
} as const;

const lookAheadBody = {
  type: "object",
  required: ["name", "startDate", "endDate"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 2000 },
    status: { type: "string", enum: LOOK_AHEAD_STATUSES },
    startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    totalWorkers: { type: ["integer", "null"], minimum: 0 },
    activityIds: { type: "array", items: { type: "string", maxLength: 100 }, maxItems: 200 },
  },
} as const;

const lookAheadPatchBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 2000 },
    status: { type: "string", enum: LOOK_AHEAD_STATUSES },
    startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    totalWorkers: { type: ["integer", "null"], minimum: 0 },
    assignActivityIds: { type: "array", items: { type: "string", maxLength: 100 }, maxItems: 200 },
    unassignActivityIds: { type: "array", items: { type: "string", maxLength: 100 }, maxItems: 200 },
  },
} as const;

const lookAheadRoutes: FastifyPluginAsync = async (fastify) => {
  const service = lookAheadsService(lookAheadsRepository(fastify.db));
  const autoWindow = autoWindowService(fastify.db);

  fastify.get<{
    Params: { id: string };
    Querystring: {
      status?: LookAheadStatus;
      timeline?: LookAheadTimeline;
      activityId?: string;
      sort?: "startDate" | "endDate" | "status";
      order?: "asc" | "desc";
    };
  }>("/projects/:id/look-aheads", { schema: { params: projectIdParams, querystring: listQuery } }, async (request) => {
    const project = await request.requireProjectAccess(request.params.id);
    return service.list(project.id, request.query);
  });

  fastify.get<{ Params: { id: string }; Querystring: { weeks?: number } }>(
    "/projects/:id/look-aheads/auto-window",
    { schema: { params: projectIdParams, querystring: autoWindowQuery } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return autoWindow.build(project.id, request.query.weeks ?? 4);
    },
  );

  fastify.get<{ Params: { id: string; lookAheadId: string } }>(
    "/projects/:id/look-aheads/:lookAheadId",
    { schema: { params: lookAheadParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.get(project.id, request.params.lookAheadId);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateLookAheadInput }>(
    "/projects/:id/look-aheads",
    { schema: { params: projectIdParams, body: lookAheadBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      const user = request.requireAuth();
      const lookAhead = await service.create(project.id, request.body, user.id);
      return reply.status(201).send(lookAhead);
    },
  );

  fastify.patch<{ Params: { id: string; lookAheadId: string }; Body: UpdateLookAheadInput }>(
    "/projects/:id/look-aheads/:lookAheadId",
    { schema: { params: lookAheadParams, body: lookAheadPatchBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      return service.update(project.id, request.params.lookAheadId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; lookAheadId: string } }>(
    "/projects/:id/look-aheads/:lookAheadId",
    { schema: { params: lookAheadParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      await service.remove(project.id, request.params.lookAheadId);
      return reply.status(204).send();
    },
  );
};

export default lookAheadRoutes;
