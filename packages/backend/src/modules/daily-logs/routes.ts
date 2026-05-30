import type { FastifyPluginAsync } from "fastify";
import { assertCanModify } from "../../lib/authorization.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { projectsRepository } from "../projects/repository.ts";
import { dailyLogsRepository } from "./repository.ts";
import { dailyLogsService } from "./service.ts";
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
  const projects = projectsRepository(fastify.db);
  const service = dailyLogsService(dailyLogsRepository(fastify.db));

  fastify.get<{ Params: { id: string }; Querystring: { from?: string; to?: string } }>(
    "/projects/:id/daily-logs",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      request.requireAuth();
      return service.listByProject(
        request.params.id,
        request.query.from,
        request.query.to,
      );
    },
  );

  fastify.get<{ Params: { id: string; date: string } }>(
    "/projects/:id/daily-logs/:date",
    { schema: { params: dateParams } },
    async (request) => {
      request.requireAuth();
      return service.getOne(request.params.id, request.params.date);
    },
  );

  fastify.put<{ Params: { id: string; date: string }; Body: UpsertDailyLogInput }>(
    "/projects/:id/daily-logs/:date",
    { schema: { params: dateParams, body: upsertBody } },
    async (request) => {
      const user = request.requireAuth();
      const project = await projects.findById(request.params.id);
      if (!project) throw new NotFoundError("Project");
      assertCanModify({ ownerId: project.owner_id }, user);

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
      const user = request.requireAuth();
      const project = await projects.findById(request.params.id);
      if (!project) throw new NotFoundError("Project");
      assertCanModify({ ownerId: project.owner_id }, user);

      const link = await service.linkActivity(
        project.id,
        request.params.date,
        request.body,
      );
      return reply.status(201).send({
        projectId: link.project_id,
        logDate: String(link.log_date).slice(0, 10),
        activityId: link.activity_id,
        hoursLogged: Number(link.hours_logged),
      });
    },
  );
};

export default dailyLogRoutes;
