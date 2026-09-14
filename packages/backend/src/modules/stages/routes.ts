import type { FastifyPluginAsync } from "fastify";
import { activitiesRepository } from "../activities/repository.ts";
import { buildingsRepository } from "../buildings/repository.ts";
import { contractsRepository } from "../contracts/repository.ts";
import { contractsService } from "../contracts/service.ts";
import { dailyLogsRepository } from "../daily-logs/repository.ts";
import { documentsRepository } from "../documents/repository.ts";
import { claimChain } from "../finances/claim-chain.ts";
import { financesRepository } from "../finances/repository.ts";
import { purchaseOrdersRepository } from "../purchase-orders/repository.ts";
import { transactionsRepository } from "../transactions/repository.ts";
import { invoiceCertificateRepository } from "../invoices/certificate-repository.ts";
import { periodLock, withForecastFlags } from "./period-lock.ts";
import { phaseRollup } from "./phase-rollup.ts";
import { stagesRepository } from "./repository.ts";
import {
  stagesService,
  type CreateStageInput,
  type ScheduleOfValueLineInput,
} from "./service.ts";
import type { UpdateScheduleProgressBody, UpdateStageInput } from "./types.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const stageParams = {
  type: "object",
  required: ["id", "stageId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    stageId: { type: "string", minLength: 1 },
  },
} as const;

const buildingQuery = {
  type: "object",
  additionalProperties: false,
  properties: { buildingId: { type: "string", minLength: 1 } },
} as const;

const STATUS = ["Done", "InProgress", "Pending"] as const;

const createStageBody = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    buildingId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    status: { type: "string", enum: STATUS },
    startDate: { type: ["string", "null"], maxLength: 40 },
    endDate: { type: ["string", "null"], maxLength: 40 },
    progressPercent: { type: "integer", minimum: 0, maximum: 100 },
    value: { type: "number", minimum: 0 },
  },
} as const;

const updateStageBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    status: { type: "string", enum: STATUS },
    startDate: { type: ["string", "null"], maxLength: 40 },
    endDate: { type: ["string", "null"], maxLength: 40 },
    progressPercent: { type: "integer", minimum: 0, maximum: 100 },
    value: { type: "number", minimum: 0 },
    contractId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    expectedCost: { type: "number", minimum: 0 },
    estimatedLaborHours: { type: "number", minimum: 0 },
    laborBudget: { type: "number", minimum: 0 },
    materialBudget: { type: "number", minimum: 0 },
  },
} as const;

const reorderBody = {
  type: "object",
  required: ["stageIds"],
  additionalProperties: false,
  properties: {
    stageIds: {
      type: "array",
      items: { type: "string", minLength: 1 },
      maxItems: 200,
    },
  },
} as const;

const scheduleOfValuesBody = {
  type: "object",
  required: ["lines"],
  additionalProperties: false,
  properties: {
    lines: {
      type: "array",
      maxItems: 240,
      items: {
        type: "object",
        required: ["period", "percent"],
        additionalProperties: false,
        properties: {
          period: { type: "string", pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$" },
          percent: { type: "number", minimum: 0, maximum: 100 },
          billed: { type: "boolean" },
        },
      },
    },
  },
} as const;

const periodParams = {
  type: "object",
  required: ["id", "stageId", "period"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    stageId: { type: "string", minLength: 1 },
    period: { type: "string", pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$" },
  },
} as const;

const scheduleProgressBody = {
  type: "object",
  required: ["percentComplete"],
  additionalProperties: false,
  properties: {
    percentComplete: { type: ["number", "null"], minimum: 0, maximum: 100 },
    /** A month later than the current one is a projection, never a claim. */
    forecast: { type: "boolean" },
  },
} as const;

const scheduleOfValueSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    stageId: { type: "string" },
    period: { type: "string" },
    percent: { type: "number" },
    amount: { type: "number" },
    billed: { type: "boolean" },
    sortOrder: { type: "integer" },
    percentComplete: { type: ["number", "null"] },
    periodPercent: { type: "number" },
    periodAmount: { type: "number" },
    toDateAmount: { type: "number" },
    forecast: { type: "boolean" },
    claimable: { type: "boolean" },
  },
} as const;

const scheduleOfValuesResponse = {
  200: { type: "array", items: scheduleOfValueSchema },
} as const;

const valueSummarySchema = {
  type: "object",
  properties: {
    valueTotal: { type: "number" },
    contractSum: { type: "number" },
    unallocated: { type: "number" },
    allocatedPercent: { type: "number" },
  },
} as const;

const stageRoutes: FastifyPluginAsync = async (fastify) => {
  const certificates = invoiceCertificateRepository(fastify.db);
  // Once a month is certified its cells close; a future month is a forecast,
  // not a claim. See stages/period-lock.ts.
  const lock = periodLock({
    certificateForPeriod: (projectId, period) => certificates.certificateForPeriod(projectId, period),
  });
  const buildings = buildingsRepository(fastify.db);
  const finances = financesRepository(fastify.db);
  const stages = stagesRepository(fastify.db);
  const contracts = contractsService(contractsRepository(fastify.db), {
    finances,
    stages,
    documents: documentsRepository(fastify.db),
  });
  const service = stagesService(
    stages,
    (projectId) => buildings.soleRealBuildingId(projectId),
    async (projectId) => {
      const summary = await finances.findSummary(projectId);
      return summary ? Number(summary.contract_sum) : 0;
    },
    async (projectId, stage) => {
      await claimChain(finances).markStageMilestonesClaimable(projectId, stage, null);
    },
    {
      rollup: phaseRollup({
        dailyLogs: dailyLogsRepository(fastify.db),
        purchaseOrders: purchaseOrdersRepository(fastify.db),
        transactions: transactionsRepository(fastify.db),
        mainContractId: (projectId) => contracts.mainContractId(projectId),
      }),
      contractBelongsToProject: (projectId, contractId) => contracts.belongsToProject(projectId, contractId),
    },
    (stageId) => activitiesRepository(fastify.db).countByPhase(stageId),
  );

  fastify.get<{ Params: { id: string }; Querystring: { buildingId?: string } }>(
    "/projects/:id/stages",
    { schema: { params: projectIdParams, querystring: buildingQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "view");
      return service.list(project.id, request.query.buildingId);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateStageInput }>(
    "/projects/:id/stages",
    { schema: { params: projectIdParams, body: createStageBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "manage");
      const stage = await service.create(project.id, request.body);
      return reply.status(201).send(stage);
    },
  );

  // Sits before /stages/:stageId so "value-summary" is not read as a stage id.
  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/stages/value-summary",
    { schema: { params: projectIdParams, response: { 200: valueSummarySchema } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "view");
      return service.valueSummary(project.id);
    },
  );

  fastify.patch<{ Params: { id: string }; Body: { stageIds: string[] } }>(
    "/projects/:id/stages/reorder",
    { schema: { params: projectIdParams, body: reorderBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "manage");
      return service.reorder(project.id, request.body.stageIds);
    },
  );

  fastify.patch<{ Params: { id: string; stageId: string }; Body: UpdateStageInput }>(
    "/projects/:id/stages/:stageId",
    { schema: { params: stageParams, body: updateStageBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "manage");
      return service.update(project.id, request.params.stageId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; stageId: string } }>(
    "/projects/:id/stages/:stageId",
    { schema: { params: stageParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "manage");
      await service.remove(project.id, request.params.stageId);
      return reply.status(204).send();
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/schedule-of-values",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "view");
      return withForecastFlags(await service.listScheduleOfValues(project.id));
    },
  );

  fastify.get<{ Params: { id: string; stageId: string } }>(
    "/projects/:id/stages/:stageId/schedule-of-values",
    { schema: { params: stageParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "view");
      return withForecastFlags(
        await service.listScheduleOfValues(project.id, request.params.stageId),
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
      const existing = await service.listScheduleOfValues(project.id, request.params.stageId);
      const kept = new Set(request.body.lines.map((line) => line.period));
      for (const line of existing) {
        if (!kept.has(line.period)) await lock.assertRemovable(project.id, line.period);
      }
      return withForecastFlags(
        await service.replaceScheduleOfValues(project.id, request.params.stageId, request.body.lines),
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
        await service.updateScheduleProgress(
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
