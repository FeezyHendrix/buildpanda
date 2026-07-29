import type { FastifyPluginAsync } from "fastify";
import { canProjectPermission } from "../../lib/authorization.ts";
import { dailyLogsRepository } from "./repository.ts";
import { dailyLogsService } from "./service.ts";
import { dailyReportService } from "./report.ts";
import { periodReportService } from "./period-report.ts";
import { REPORT_PERIODS, type ReportPeriod } from "../../lib/report-period.ts";
import { updatesRepository } from "../updates/repository.ts";
import { updatesService } from "../updates/service.ts";
import { activitiesRepository } from "../activities/repository.ts";
import { activitiesService } from "../activities/service.ts";
import { buildingsRepository } from "../buildings/repository.ts";
import { filesRepository } from "../files/repository.ts";
import { filesService } from "../files/service.ts";
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
    buildingId: { type: "string", minLength: 1, maxLength: 100 },
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
    summaryHtml: { type: ["string", "null"], maxLength: 200000 },
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

const voidBody = {
  type: "object",
  required: ["reason"],
  additionalProperties: false,
  properties: {
    reason: { type: "string", minLength: 1, maxLength: 8000 },
  },
} as const;

const periodReportQuery = {
  type: "object",
  required: ["period"],
  additionalProperties: false,
  properties: {
    period: { type: "string", enum: [...REPORT_PERIODS] },
    date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
  },
} as const;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const reportEmailBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    email: { type: "string", format: "email", maxLength: 320 },
  },
} as const;

const entryBody = {
  type: "object",
  required: ["bodyHtml"],
  additionalProperties: false,
  properties: {
    bodyHtml: { type: "string", minLength: 1, maxLength: 200000 },
    bodyText: { type: ["string", "null"], maxLength: 20000 },
  },
} as const;

const entryParams = {
  type: "object",
  required: ["id", "date", "entryId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    entryId: { type: "string", minLength: 1 },
  },
} as const;

const dailyLogRoutes: FastifyPluginAsync = async (fastify) => {
  const buildings = buildingsRepository(fastify.db);
  const updates = updatesService(updatesRepository(fastify.db));
  const activitiesRepo = activitiesRepository(fastify.db);
  const activities = activitiesService(activitiesRepo, (projectId) =>
    fastify.queue.enqueue(PROGRESS_RECOMPUTE_QUEUE, "recompute", { projectId }),
    (projectId) => buildings.soleRealBuildingId(projectId),
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
  }, (projectId) => buildings.soleRealBuildingId(projectId));

  const reports = dailyReportService(fastify.db, {
    logs: service,
    files: filesService(filesRepository(fastify.db)),
  });

  const periodReports = periodReportService(fastify.db, { logs: service });

  fastify.get<{ Params: { id: string }; Querystring: { from?: string; to?: string; buildingId?: string } }>(
    "/projects/:id/daily-logs",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "dailyLog", "view");
      return service.listDays(project.id, request.query.from, request.query.to, request.query.buildingId);
    },
  );

  fastify.get<{ Params: { id: string; date: string } }>(
    "/projects/:id/daily-logs/:date/day",
    { schema: { params: dateParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "dailyLog", "view");
      return service.getDay(project.id, request.params.date);
    },
  );

  fastify.post<{ Params: { id: string; date: string }; Body: { bodyHtml: string; bodyText?: string | null } }>(
    "/projects/:id/daily-logs/:date/entries",
    { schema: { params: dateParams, body: entryBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "dailyLog", "view");
      const user = request.requireAuth();
      const role =
        request.projectRoles.get(project.id) ??
        (project.organization_id ? request.orgRoles.get(project.organization_id) : undefined) ??
        "member";
      const entry = await service.addEntry(
        project.id,
        request.params.date,
        request.body.bodyHtml,
        request.body.bodyText ?? null,
        { id: user.id, name: user.name, role },
      );
      return reply.status(201).send(entry);
    },
  );

  fastify.post<{ Params: { id: string; date: string; entryId: string }; Body: { reason: string } }>(
    "/projects/:id/daily-logs/:date/entries/:entryId/void",
    { schema: { params: entryParams, body: voidBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "dailyLog", "view");
      const user = request.requireAuth();
      const canManage = canProjectPermission(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        {
          userId: user.id,
          orgRoles: request.orgRoles,
          projectRoles: request.projectRoles,
          orgPermissions: request.orgPermissions,
          projectSectionPermissions: request.projectSectionPermissions,
        },
        "dailyLog",
        "void",
      );
      return service.voidEntry(project.id, request.params.entryId, request.body.reason, {
        id: user.id,
        name: user.name,
        canManage,
      });
    },
  );

  fastify.get<{ Params: { id: string; date: string } }>(
    "/projects/:id/daily-logs/:date",
    { schema: { params: dateParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "dailyLog", "view");
      return service.getOne(project.id, request.params.date);
    },
  );

  fastify.put<{ Params: { id: string; date: string }; Body: UpsertDailyLogInput }>(
    "/projects/:id/daily-logs/:date",
    { schema: { params: dateParams, body: upsertBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "dailyLog", "create");
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
      const project = await request.requireProjectPermission(request.params.id, "dailyLog", "create");
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

  fastify.post<{ Params: { id: string; date: string }; Body: { reason: string } }>(
    "/projects/:id/daily-logs/:date/void",
    { schema: { params: dateParams, body: voidBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "dailyLog", "void");
      const user = request.requireAuth();
      return service.voidLog(project.id, request.params.date, request.body.reason, user.id);
    },
  );

  fastify.get<{ Params: { id: string; date: string } }>(
    "/projects/:id/daily-logs/:date/report",
    { schema: { params: dateParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(
        request.params.id,
        "dailyLog",
        "report",
      );
      const report = await reports.build(project.id, request.params.date);
      return reply
        .header("content-type", "application/pdf")
        .header("content-disposition", `attachment; filename="${report.fileName}"`)
        .send(report.pdf);
    },
  );

  fastify.post<{
    Params: { id: string; date: string };
    Body: { email?: string };
  }>(
    "/projects/:id/daily-logs/:date/report/email",
    { schema: { params: dateParams, body: reportEmailBody } },
    async (request) => {
      const project = await request.requireProjectPermission(
        request.params.id,
        "dailyLog",
        "report",
      );
      const user = request.requireAuth();
      const result = await reports.emailTo(project.id, request.params.date, {
        email: request.body.email ?? user.email,
        name: user.name,
      });
      return { sentTo: request.body.email ?? user.email, logDate: result.day.logDate };
    },
  );

  fastify.get<{ Params: { id: string }; Querystring: { period: ReportPeriod; date?: string } }>(
    "/projects/:id/daily-logs/period-report",
    { schema: { params: projectIdParams, querystring: periodReportQuery } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(
        request.params.id,
        "dailyLog",
        "report",
      );
      const referenceDate = request.query.date ?? todayIso();
      const report = await periodReports.build(project.id, request.query.period, referenceDate);
      return reply
        .header(
          "content-type",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        .header("content-disposition", `attachment; filename="${report.fileName}"`)
        .send(report.docx);
    },
  );
};

export default dailyLogRoutes;
