import { buildDailyLogsService } from "./wiring.ts";
import type { FastifyPluginAsync } from "fastify";
import { dailyLogEntryVoidActor } from "./access.ts";
import { dailyLogsRepository } from "./repository.ts";
import { dailyLogCoverage, dailyLogCoverageDeps } from "./coverage.ts";
import { dailyReportService } from "./report.ts";
import { periodReportService } from "./period-report.ts";
import type { ReportPeriod } from "../../lib/report-period.ts";
import { filesRepository } from "../files/repository.ts";
import { filesService } from "../files/service.ts";
import type { CreateDailyLogEntryInput, LinkActivityInput, UpsertDailyLogInput } from "./types.ts";
import {
  projectIdParams,
  dateParams,
  listQuery,
  buildingQuery,
  upsertBody,
  linkActivityBody,
  coverageSchema,
  voidBody,
  periodReportQuery,
  reportEmailBody,
  entryBody,
  entryParams,
} from "./schemas.ts";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const dailyLogRoutes: FastifyPluginAsync = async (fastify) => {
  const service = buildDailyLogsService(fastify.db, fastify.queue);

  const reports = dailyReportService(fastify.db, {
    logs: service,
    files: filesService(filesRepository(fastify.db)),
  });

  const periodReports = periodReportService(fastify.db, { logs: service });

  const coverageDeps = dailyLogCoverageDeps(fastify.db, dailyLogsRepository(fastify.db));

  fastify.get<{ Params: { id: string }; Querystring: { from?: string; to?: string; buildingId?: string } }>(
    "/projects/:id/daily-logs",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "dailyLog", "view");
      return service.listDays(project.id, request.query.from, request.query.to, request.query.buildingId);
    },
  );

  // The calendar-aware coverage figure the Overview and the missed-days chip
  // read: working days on the project's own calendar, from the works start, to
  // yesterday, with no live log.
  fastify.get<{ Params: { id: string }; Querystring: { buildingId?: string } }>(
    "/projects/:id/daily-logs/coverage",
    {
      schema: {
        params: projectIdParams,
        querystring: { type: "object", additionalProperties: false, properties: { buildingId: { type: "string", minLength: 1, maxLength: 100 } } } as const,
        response: { 200: coverageSchema },
      },
    },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "dailyLog", "view");
      return dailyLogCoverage(coverageDeps, project.id, request.query.buildingId);
    },
  );

  fastify.get<{ Params: { id: string; date: string }; Querystring: { buildingId?: string } }>(
    "/projects/:id/daily-logs/:date/day",
    { schema: { params: dateParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "dailyLog", "view");
      return service.getDay(project.id, request.params.date, request.query.buildingId);
    },
  );

  fastify.post<{ Params: { id: string; date: string }; Body: CreateDailyLogEntryInput }>(
    "/projects/:id/daily-logs/:date/entries",
    { schema: { params: dateParams, body: entryBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "dailyLog", "create");
      const user = request.requireAuth();
      const role =
        request.projectRoles.get(project.id) ??
        (project.organization_id ? request.orgRoles.get(project.organization_id) : undefined) ??
        "member";
      const entry = await service.addEntry(project.id, request.params.date, request.body, {
        id: user.id,
        name: user.name,
        role,
      });
      return reply.status(201).send(entry);
    },
  );

  fastify.post<{ Params: { id: string; date: string; entryId: string }; Body: { reason: string } }>(
    "/projects/:id/daily-logs/:date/entries/:entryId/void",
    { schema: { params: entryParams, body: voidBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "dailyLog", "create");
      const user = request.requireAuth();
      return service.voidEntry(project.id, request.params.entryId, request.body.reason,
        dailyLogEntryVoidActor(request, project, user));
    },
  );

  fastify.get<{ Params: { id: string; date: string }; Querystring: { buildingId?: string } }>(
    "/projects/:id/daily-logs/:date",
    { schema: { params: dateParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "dailyLog", "view");
      return service.getOne(project.id, request.params.date, request.query.buildingId);
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

  fastify.post<{ Params: { id: string; date: string }; Querystring: { buildingId?: string }; Body: { reason: string } }>(
    "/projects/:id/daily-logs/:date/void",
    { schema: { params: dateParams, querystring: buildingQuery, body: voidBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "dailyLog", "void");
      const user = request.requireAuth();
      return service.voidLog(project.id, request.params.date, request.body.reason, user.id, request.query.buildingId);
    },
  );

  fastify.get<{ Params: { id: string; date: string }; Querystring: { buildingId?: string } }>(
    "/projects/:id/daily-logs/:date/report",
    { schema: { params: dateParams, querystring: buildingQuery } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(
        request.params.id,
        "dailyLog",
        "report",
      );
      const report = await reports.build(project.id, request.params.date, request.query.buildingId);
      return reply
        .header("content-type", "application/pdf")
        .header("content-disposition", `attachment; filename="${report.fileName}"`)
        .send(report.pdf);
    },
  );

  fastify.post<{
    Params: { id: string; date: string };
    Body: { email?: string; buildingId?: string };
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
      }, request.body.buildingId);
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
      const user = request.requireAuth();
      const referenceDate = request.query.date ?? todayIso();
      const report = await periodReports.build(project.id, request.query.period, referenceDate, {
        id: user.id,
        name: user.name ?? null,
      });
      return reply
        .header(
          "content-type",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        .header("content-disposition", `attachment; filename="${report.fileName}"`)
        .header("x-report-generated-at", report.generatedAt)
        .send(report.docx);
    },
  );
};

export default dailyLogRoutes;
