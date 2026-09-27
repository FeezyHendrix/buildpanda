import type { FastifyPluginAsync } from "fastify";
import { BadRequestError } from "../../lib/errors.ts";
import { toCalendar } from "../../lib/working-days.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { buildingsRepository } from "../buildings/repository.ts";
import { keyDatesRepository } from "../key-dates/repository.ts";
import { keyDatesService } from "../key-dates/service.ts";
import { activitiesRepository } from "./repository.ts";
import { activitiesService } from "./service.ts";
import { delaysService } from "./delays.ts";
import { runProgressRecompute } from "./progress-job.ts";
import { CULPABILITIES } from "./types.ts";
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

const buildingQuery = {
  type: "object",
  additionalProperties: false,
  properties: { buildingId: { type: "string", minLength: 1 } },
} as const;

const predecessorsSchema = {
  type: "array",
  maxItems: 100,
  items: {
    type: "object",
    required: ["activityId", "type", "lagDays"],
    additionalProperties: false,
    properties: {
      activityId: { type: "string", minLength: 1, maxLength: 100 },
      type: { type: "string", enum: ["FS", "SS", "FF", "SF"] },
      lagDays: { type: "integer", minimum: -365, maximum: 365 },
    },
  },
} as const;

const createActivityBody = {
  type: "object",
  required: ["name", "activityType", "plannedStartAt", "plannedEndAt"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    activityType: { type: "string", minLength: 1, maxLength: 100 },
    buildingId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    phaseId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    // Optional means optional: an empty box arrives as "" and is stored as null.
    location: { type: "string", maxLength: 200 },
    plannedStartAt: isoString,
    plannedEndAt: isoString,
    workerCountPlanned: { type: "integer", minimum: 0, maximum: 5000 },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
    notes: { type: "string", maxLength: 2000 },
    predecessors: predecessorsSchema,
    percentComplete: { type: "number", minimum: 0, maximum: 100 },
    isMilestone: { type: "boolean" },
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
    assigneeId: { type: ["string", "null"], maxLength: 100 },
    predecessors: predecessorsSchema,
    percentComplete: { type: "number", minimum: 0, maximum: 100 },
    isMilestone: { type: "boolean" },
  },
} as const;

const delayLinkProps = {
  linkedRfiId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
  linkedChangeRequestId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
  linkedMaterialOrderId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
} as const;

const raiseDelayBody = {
  type: "object",
  required: ["reasonCode", "startedAt"],
  additionalProperties: false,
  properties: {
    reasonCode: { type: "string", minLength: 1, maxLength: 50 },
    description: { type: "string", maxLength: 2000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    startedAt: isoString,
    endedAt: { type: ["string", "null"], minLength: 1, maxLength: 40 },
    daysLost: { type: "integer", minimum: 0, maximum: 3650 },
    culpability: { type: "string", enum: CULPABILITIES },
    eotClaimable: { type: "boolean" },
    ...delayLinkProps,
    costImpact: { type: "number", minimum: 0 },
    currency: { type: "string", enum: ["NGN", "USD"] },
    preventionNotes: { type: "string", maxLength: 2000 },
  },
} as const;

const resolveDelayBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    resolvedAt: isoString,
    endedAt: { type: ["string", "null"], minLength: 1, maxLength: 40 },
    daysLost: { type: "integer", minimum: 0, maximum: 3650 },
    culpability: { type: "string", enum: CULPABILITIES },
    eotClaimable: { type: "boolean" },
    ...delayLinkProps,
    preventionNotes: { type: "string", maxLength: 2000 },
  },
} as const;

const delaySchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    activityId: { type: "string" },
    reasonCode: { type: "string" },
    reasonName: { type: "string" },
    reasonCategory: { type: "string" },
    description: { type: ["string", "null"] },
    descriptionHtml: { type: ["string", "null"] },
    startedAt: { type: "string" },
    endedAt: { type: ["string", "null"] },
    daysLost: { type: "integer" },
    culpability: { type: "string", enum: CULPABILITIES },
    eotClaimable: { type: "boolean" },
    linkedRfiId: { type: ["string", "null"] },
    linkedChangeRequestId: { type: ["string", "null"] },
    linkedMaterialOrderId: { type: ["string", "null"] },
    appliedShiftDays: { type: "integer" },
    resolvedAt: { type: ["string", "null"] },
    resolvedById: { type: ["string", "null"] },
    costImpact: { type: "number" },
    currency: { type: "string" },
    preventionNotes: { type: ["string", "null"] },
    recordedBy: {
      type: ["object", "null"],
      properties: { id: { type: "string" }, name: { type: ["string", "null"] } },
    },
    createdAt: { type: "string" },
  },
} as const;

const activityEventSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    activityId: { type: "string" },
    kind: { type: "string" },
    summary: { type: "string" },
    daysDelta: { type: "integer" },
    delayId: { type: ["string", "null"] },
    actorId: { type: ["string", "null"] },
    createdAt: { type: "string" },
  },
} as const;

const activityRoutes: FastifyPluginAsync = async (fastify) => {
  const buildings = buildingsRepository(fastify.db);
  const repository = activitiesRepository(fastify.db);
  const keyDates = keyDatesService(keyDatesRepository(fastify.db), async (projectId, explicit) => {
    if (explicit) return explicit;
    const buildingId = await buildings.soleRealBuildingId(projectId);
    if (!buildingId) throw new BadRequestError("buildingId is required for a multi-building project");
    return buildingId;
  });
  const calendarFor = async (projectId: string) => {
    const row = await repository.projectCalendar(projectId);
    return toCalendar(row?.working_days, row?.holidays);
  };
  const service = activitiesService(
    repository,
    // Synchronous on purpose: interactive edits must see progress_percent
    // updated before the response returns, or the UI refetch races the job.
    // Bulk paths (programme import, daily logs) still go through the queue.
    (projectId) => runProgressRecompute(fastify.db, { projectId }),
    (projectId) => buildings.soleRealBuildingId(projectId),
    {
      notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue),
      calendarFor,
    },
  );
  const delays = delaysService(repository, {
    calendarFor,
    // A programme move carries its non-contractual key dates with it; the
    // key-dates module owns that rule, so it runs through its service.
    onActivitiesShifted: async (projectId, moves) => {
      await keyDates.shiftForActivityMoves(
        projectId,
        moves.map((m) => ({ id: m.id, days: m.days })),
      );
    },
  });

  fastify.get<{ Params: { id: string }; Querystring: { buildingId?: string } }>(
    "/projects/:id/activities",
    { schema: { params: projectIdParams, querystring: buildingQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "view");
      return service.listByProject(project.id, request.query.buildingId);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateActivityInput }>(
    "/projects/:id/activities",
    { schema: { params: projectIdParams, body: createActivityBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      const user = request.requireAuth();
      const activity = await service.create(project.id, request.body, {
        id: user.id,
        name: user.name,
      });
      return reply.status(201).send(activity);
    },
  );

  fastify.get<{ Params: { id: string }; Querystring: { buildingId?: string } }>(
    "/projects/:id/programme/export.xml",
    { schema: { params: projectIdParams, querystring: buildingQuery } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "view");
      const xml = await service.exportProgrammeXml(
        project.id,
        project.name,
        request.query.buildingId,
      );
      const fileName = `${project.name.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}-programme.xml`;
      return reply
        .header("content-type", "application/xml; charset=utf-8")
        .header("content-disposition", `attachment; filename="${fileName}"`)
        .send(xml);
    },
  );

  fastify.get<{ Params: { id: string; activityId: string } }>(
    "/projects/:id/activities/:activityId",
    { schema: { params: activityParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "view");
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
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      const user = request.requireAuth();
      return service.update(project.id, request.params.activityId, request.body, user.id);
    },
  );

  fastify.delete<{ Params: { id: string; activityId: string } }>(
    "/projects/:id/activities/:activityId",
    { schema: { params: activityParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      await service.remove(project.id, request.params.activityId);
      return reply.status(204).send();
    },
  );

  fastify.get<{ Params: { id: string; activityId: string } }>(
    "/projects/:id/activities/:activityId/delays",
    {
      schema: {
        params: activityParams,
        response: { 200: { type: "array", items: delaySchema } },
      },
    },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "view");
      return delays.listForActivity(project.id, request.params.activityId);
    },
  );

  fastify.get<{ Params: { id: string; activityId: string } }>(
    "/projects/:id/activities/:activityId/events",
    {
      schema: {
        params: activityParams,
        response: { 200: { type: "array", items: activityEventSchema } },
      },
    },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "view");
      return service.listEvents(project.id, request.params.activityId);
    },
  );

  fastify.post<{
    Params: { id: string; activityId: string };
    Body: RaiseDelayInput;
  }>(
    "/projects/:id/activities/:activityId/delays",
    { schema: { params: activityParams, body: raiseDelayBody, response: { 201: delaySchema } } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      const user = request.requireAuth();
      const delay = await delays.raise(project.id, request.params.activityId, request.body, {
        id: user.id,
        name: user.name,
      });
      return reply.status(201).send(delay);
    },
  );

  fastify.patch<{
    Params: { id: string; activityId: string; delayId: string };
    Body: ResolveDelayInput;
  }>(
    "/projects/:id/activities/:activityId/delays/:delayId",
    { schema: { params: delayParams, body: resolveDelayBody, response: { 200: delaySchema } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "manage");
      const user = request.requireAuth();
      return delays.amend(
        project.id,
        request.params.activityId,
        request.params.delayId,
        request.body,
        { id: user.id, name: user.name },
      );
    },
  );

  fastify.get("/delay-reasons", async (request) => {
    request.requireAuth();
    return service.listReasons();
  });
};

export default activityRoutes;
