import type { FastifyPluginAsync } from "fastify";
import { materialsLedgerRepository } from "./repository.ts";
import { materialsLedgerService, type LogEntryInput } from "./service.ts";
import { materialReportService } from "./report.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { tasksRepository } from "../tasks/repository.ts";
import { tasksService } from "../tasks/service.ts";
import { projectsRepository } from "../projects/repository.ts";
import { filesRepository } from "../files/repository.ts";
import { filesService } from "../files/service.ts";
import { logger } from "../../lib/logger.ts";

const ENTRY_TYPE = ["IN", "USED"] as const;

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const entryParams = {
  type: "object",
  required: ["id", "entryId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    entryId: { type: "string", minLength: 1 },
  },
} as const;

const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    materialId: { type: "string", maxLength: 100 },
    entryType: { type: "string", enum: ENTRY_TYPE },
    limit: { type: "integer", minimum: 1, maximum: 200 },
    before: { type: "string", maxLength: 40 },
  },
} as const;

const logBody = {
  type: "object",
  required: ["entryType", "materialName", "quantity"],
  additionalProperties: false,
  properties: {
    entryType: { type: "string", enum: ENTRY_TYPE },
    materialName: { type: "string", minLength: 1, maxLength: 200 },
    unit: { type: "string", maxLength: 40 },
    quantity: { type: "number", exclusiveMinimum: 0 },
    locationKey: { type: ["string", "null"], maxLength: 100 },
    occurredAt: { type: ["string", "null"], maxLength: 40 },
    materialOrderId: { type: ["string", "null"], maxLength: 100 },
    taskId: { type: ["string", "null"], maxLength: 100 },
    activityId: { type: ["string", "null"], maxLength: 100 },
    fileIds: { type: "array", items: { type: "string", maxLength: 100 }, maxItems: 10 },
    reason: { type: ["string", "null"], maxLength: 1000 },
    notesHtml: { type: ["string", "null"], maxLength: 200000 },
    idempotencyKey: { type: ["string", "null"], maxLength: 100 },
  },
} as const;

const voidBody = {
  type: "object",
  required: ["reason"],
  additionalProperties: false,
  properties: { reason: { type: "string", minLength: 1, maxLength: 1000 } },
} as const;

const reportEmailBody = {
  type: "object",
  additionalProperties: false,
  properties: { email: { type: "string", format: "email", maxLength: 320 } },
} as const;

const materialsLedgerRoutes: FastifyPluginAsync = async (fastify) => {
  const notifications = notificationsService(notificationsRepository(fastify.db), fastify.queue);
  const tasks = tasksService(tasksRepository(fastify.db), { notifications });
  const projects = projectsRepository(fastify.db);

  const service = materialsLedgerService(materialsLedgerRepository(fastify.db), {
    onNegativeStock: ({ projectId, materialName, onHandQty, actorId }) => {
      void (async () => {
        try {
          const project = await projects.findById(projectId);
          const ownerId = project?.owner_id ?? null;
          if (ownerId) {
            await notifications.notify(ownerId, "material_negative_stock", {
              title: "Negative stock detected",
              body: `${materialName} is at ${onHandQty}. Logged usage exceeds recorded deliveries.`,
              projectId,
            });
          }
          await tasks.createTask(
            projectId,
            {
              title: `Reconcile negative stock: ${materialName}`,
              description: `On-hand for ${materialName} is ${onHandQty}. Confirm deliveries were logged or correct the ledger.`,
              assigneeId: ownerId,
              sourceType: "material_reconciliation",
              sourceId: materialName,
            },
            actorId,
          );
        } catch (error) {
          logger.error({ err: error, projectId }, "Failed negative-stock side effects");
        }
      })();
    },
  });

  const reports = materialReportService(fastify.db, {
    ledger: service,
    files: filesService(filesRepository(fastify.db)),
  });

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/materials/stock",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.getStock(project.id);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/materials/catalog",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.getCatalog(project.id);
    },
  );

  fastify.get<{ Params: { id: string }; Querystring: { materialId?: string; entryType?: "IN" | "USED"; limit?: number; before?: string } }>(
    "/projects/:id/materials/ledger",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.listLedger(project.id, request.query);
    },
  );

  fastify.post<{ Params: { id: string }; Body: LogEntryInput }>(
    "/projects/:id/materials/ledger",
    { schema: { params: projectIdParams, body: logBody } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      const result = await service.logEntry(project.id, request.body, user.id);
      return reply.status(result.duplicate ? 200 : 201).send(result);
    },
  );

  fastify.post<{ Params: { id: string; entryId: string }; Body: { reason: string } }>(
    "/projects/:id/materials/ledger/:entryId/void",
    { schema: { params: entryParams, body: voidBody } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      const entry = await service.voidEntry(project.id, request.params.entryId, request.body.reason, user.id);
      return reply.status(201).send(entry);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/materials/report",
    { schema: { params: projectIdParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "report");
      const report = await reports.build(project.id);
      return reply
        .header("content-type", "application/pdf")
        .header("content-disposition", `attachment; filename="${report.fileName}"`)
        .send(report.pdf);
    },
  );

  fastify.post<{ Params: { id: string }; Body: { email?: string } }>(
    "/projects/:id/materials/report/email",
    { schema: { params: projectIdParams, body: reportEmailBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "report");
      const user = request.requireAuth();
      await reports.emailTo(project.id, { email: request.body.email ?? user.email, name: user.name });
      return { sentTo: request.body.email ?? user.email };
    },
  );
};

export default materialsLedgerRoutes;
