import { buildStagesService } from "./wiring.ts";
import { expenseReaderId } from "../transactions/access.ts";
import type { FastifyPluginAsync } from "fastify";
import { invoiceCertificateRepository } from "../invoices/certificate-repository.ts";
import { periodLock, withForecastFlags } from "./period-lock.ts";
import {
  type CreateStageInput,
  type ScheduleOfValueLineInput,
} from "./service.ts";
import type { UpdateScheduleProgressBody, UpdateStageInput } from "./types.ts";

import { projectIdParams, stageParams, buildingQuery, createStageBody, updateStageBody, reorderBody, scheduleOfValuesBody, periodParams, scheduleProgressBody, scheduleOfValuesResponse, valueSummarySchema } from "./route-schemas.ts";

const stageRoutes: FastifyPluginAsync = async (fastify) => {
  const certificates = invoiceCertificateRepository(fastify.db);
  // Once a month is certified its cells close; a future month is a forecast,
  // not a claim. See stages/period-lock.ts.
  const lock = periodLock({
    certificateForPeriod: (projectId, period) => certificates.certificateForPeriod(projectId, period),
  });
  const service = (readerId: string | undefined) => buildStagesService(fastify.db, readerId);

  fastify.get<{ Params: { id: string }; Querystring: { buildingId?: string } }>(
    "/projects/:id/stages",
    { schema: { params: projectIdParams, querystring: buildingQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "view");
      return service(expenseReaderId(request, project)).list(project.id, request.query.buildingId);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateStageInput }>(
    "/projects/:id/stages",
    { schema: { params: projectIdParams, body: createStageBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "manage");
      const stage = await service(expenseReaderId(request, project)).create(project.id, request.body);
      return reply.status(201).send(stage);
    },
  );

  // Sits before /stages/:stageId so "value-summary" is not read as a stage id.
  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/stages/value-summary",
    { schema: { params: projectIdParams, response: { 200: valueSummarySchema } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "view");
      return service(expenseReaderId(request, project)).valueSummary(project.id);
    },
  );

  fastify.patch<{ Params: { id: string }; Body: { stageIds: string[] } }>(
    "/projects/:id/stages/reorder",
    { schema: { params: projectIdParams, body: reorderBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "manage");
      return service(expenseReaderId(request, project)).reorder(project.id, request.body.stageIds);
    },
  );

  fastify.patch<{ Params: { id: string; stageId: string }; Body: UpdateStageInput }>(
    "/projects/:id/stages/:stageId",
    { schema: { params: stageParams, body: updateStageBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "manage");
      return service(expenseReaderId(request, project)).update(project.id, request.params.stageId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; stageId: string } }>(
    "/projects/:id/stages/:stageId",
    { schema: { params: stageParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "manage");
      await service(expenseReaderId(request, project)).remove(project.id, request.params.stageId);
      return reply.status(204).send();
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/schedule-of-values",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "view");
      return withForecastFlags(await service(expenseReaderId(request, project)).listScheduleOfValues(project.id));
    },
  );

  fastify.get<{ Params: { id: string; stageId: string } }>(
    "/projects/:id/stages/:stageId/schedule-of-values",
    { schema: { params: stageParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "view");
      return withForecastFlags(
        await service(expenseReaderId(request, project)).listScheduleOfValues(project.id, request.params.stageId),
      );
    },
  );

  fastify.put<{
    Params: { id: string; stageId: string };
    Body: { lines: ScheduleOfValueLineInput[] };
  }>(
    "/projects/:id/stages/:stageId/schedule-of-values",
    { schema: { params: stageParams, body: scheduleOfValuesBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "manage");
      // Dropping or re-planning a month is fine until it has been certified.
      const existing = await service(expenseReaderId(request, project)).listScheduleOfValues(project.id, request.params.stageId);
      const kept = new Set(request.body.lines.map((line) => line.period));
      for (const line of existing) {
        if (!kept.has(line.period)) await lock.assertRemovable(project.id, line.period);
      }
      return withForecastFlags(
        await service(expenseReaderId(request, project)).replaceScheduleOfValues(project.id, request.params.stageId, request.body.lines),
      );
    },
  );

  // One cell of the billing sheet: cumulative % complete for a stage-month.
  // Billing progress is a finance record, so it takes the finances permission
  // rather than the stage-planning one.
  fastify.patch<{
    Params: { id: string; stageId: string; period: string };
    Body: UpdateScheduleProgressBody;
  }>(
    "/projects/:id/stages/:stageId/schedule-of-values/:period",
    { schema: { params: periodParams, body: scheduleProgressBody, response: scheduleOfValuesResponse } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      await lock.assertEditable(project.id, request.params.period);
      lock.assertClaimable(request.params.period, request.body.forecast ?? false);
      return withForecastFlags(
        await service(expenseReaderId(request, project)).updateScheduleProgress(
          project.id,
          request.params.stageId,
          request.params.period,
          request.body.percentComplete,
        ),
      );
    },
  );
};

export default stageRoutes;
