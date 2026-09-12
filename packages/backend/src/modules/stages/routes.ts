import type { FastifyPluginAsync } from "fastify";
import { buildingsRepository } from "../buildings/repository.ts";
import { contractsRepository } from "../contracts/repository.ts";
import { contractsService } from "../contracts/service.ts";
import { dailyLogsRepository } from "../daily-logs/repository.ts";
import { documentsRepository } from "../documents/repository.ts";
import { claimChain } from "../finances/claim-chain.ts";
import { financesRepository } from "../finances/repository.ts";
import { purchaseOrdersRepository } from "../purchase-orders/repository.ts";
import { transactionsRepository } from "../transactions/repository.ts";
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
  },
} as const;

const scheduleOfValuesResponse = {
  200: { type: "array", items: scheduleOfValueSchema },
} as const;

const stageRoutes: FastifyPluginAsync = async (fastify) => {
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
      return service.listScheduleOfValues(project.id);
    },
  );

  fastify.get<{ Params: { id: string; stageId: string } }>(
    "/projects/:id/stages/:stageId/schedule-of-values",
    { schema: { params: stageParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "stages", "view");
      return service.listScheduleOfValues(project.id, request.params.stageId);
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
      return service.replaceScheduleOfValues(
        project.id,
        request.params.stageId,
        request.body.lines,
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
      return service.updateScheduleProgress(
        project.id,
        request.params.stageId,
        request.params.period,
        request.body.percentComplete,
      );
    },
  );
};

export default stageRoutes;
