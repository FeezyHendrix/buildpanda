import type { FastifyPluginAsync } from "fastify";
import { dailyLogsRepository } from "./repository.ts";
import { dailyLogsService } from "./service.ts";
import { updatesRepository } from "../updates/repository.ts";
import { updatesService } from "../updates/service.ts";
import { activitiesRepository } from "../activities/repository.ts";
import { activitiesService } from "../activities/service.ts";
import { PROGRESS_RECOMPUTE_QUEUE } from "../activities/progress-job.ts";
import type { LinkActivityInput, UpsertDailyLogInput } from "./types.ts";

const projectIdParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

const dateParams = {
  type: "object",
  required: ["id", "date"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
  },
} as const;

const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    from: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    to: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
  },
} as const;

const upsertBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    weatherCondition: {
      type: ["string", "null"],
      enum: ["Sunny", "Cloudy", "Rain", "Storm", "Fog", "ExtremeHeat", null],
    },
    temperatureC: { type: ["number", "null"] },
    precipitationMm: { type: ["number", "null"], minimum: 0 },
    windKph: { type: ["number", "null"], minimum: 0 },
    workersExpected: { type: "integer", minimum: 0, maximum: 5000 },
    workersPresent: { type: "integer", minimum: 0, maximum: 5000 },
    totalHours: { type: "number", minimum: 0, maximum: 100000 },
    summary: { type: ["string", "null"], maxLength: 4000 },
  },
} as const;

const linkActivityBody = {
  type: "object",
  required: ["activityId", "hoursLogged"],
  additionalProperties: false,
  properties: {
    activityId: { type: "string", minLength: 1, maxLength: 100 },
    hoursLogged: { type: "number", minimum: 0, maximum: 5000 },
  },
} as const;

const dailyLogRoutes: FastifyPluginAsync = async (fastify) => {
  const updates = updatesService(updatesRepository(fastify.db));
  const activitiesRepo = activitiesRepository(fastify.db);
  const activities = activitiesService(activitiesRepo, (projectId) =>
    fastify.queue.enqueue(PROGRESS_RECOMPUTE_QUEUE, "recompute", { projectId }),
  );
  const service = dailyLogsService(dailyLogsRepository(fastify.db), {
    createUpdate: (projectId, input, actor) => updates.create(projectId, input, actor),
    markActivityInProgress: async (projectId, activityId) => {
      const current = await activitiesRepo.findById(activityId).catch(() => undefined);
      if (current && current.status === "Planned") {
        await activities
          .update(projectId, activityId, { status: "InProgress" })
          .catch(() => undefined);
      }
    },
  });

  fastify.get<{ Params: { id: string }; Querystring: { from?: string; to?: string } }>(
    "/projects/:id/daily-logs",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.listByProject(
        project.id,
        request.query.from,
        request.query.to,
      );
    },
  );

  fastify.get<{ Params: { id: string; date: string } }>(
    "/projects/:id/daily-logs/:date",
    { schema: { params: dateParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.getOne(project.id, request.params.date);
    },
  );

  fastify.put<{ Params: { id: string; date: string }; Body: UpsertDailyLogInput }>(
    "/projects/:id/daily-logs/:date",
    { schema: { params: dateParams, body: upsertBody } },
    async (request) => {
      const project = await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      return service.upsert(project.id, request.params.date, request.body, user.id);
    },
  );

  fastify.post<{
    Params: { id: string; date: string };
    Body: LinkActivityInput;
  }>(
    "/projects/:id/daily-logs/:date/activities",
    { schema: { params: dateParams, body: linkActivityBody } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      const link = await service.linkActivity(
        project.id,
        request.params.date,
        request.body,
        { id: user.id, name: user.name },
      );
      return reply.status(201).send({
        projectId: link.project_id,
        logDate: String(link.log_date).slice(0, 10),
        activityId: link.activity_id,
        hoursLogged: Number(link.hours_logged),
      });
    },
  );

  fastify.delete<{ Params: { id: string; date: string } }>(
    "/projects/:id/daily-logs/:date",
    { schema: { params: dateParams } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      await service.remove(project.id, request.params.date);
      return reply.status(204).send();
    },
  );
};

export default dailyLogRoutes;
