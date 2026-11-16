import type { FastifyPluginAsync } from "fastify";
import type { LogEntryInput } from "./types.ts";
import { buildMaterialsLedgerService } from "./wiring.ts";
import { requireMaterialLogPermission } from "./permissions.ts";
import { materialLogBody, voidLedgerBody } from "./schemas.ts";
import { materialReportService } from "./report.ts";
import type { ReorderPolicyInput } from "./types.ts";
import { filesRepository } from "../files/repository.ts";
import { filesService } from "../files/service.ts";

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

const materialIdParams = {
  type: "object",
  required: ["id", "materialId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    materialId: { type: "string", minLength: 1 },
  },
} as const;

const reorderPolicyBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    lowStockThreshold: { type: ["number", "null"], minimum: 0 },
    reorderQuantity: { type: ["number", "null"], exclusiveMinimum: 0 },
    leadTimeDays: { type: ["integer", "null"], minimum: 0 },
    preferredSupplierId: { type: ["string", "null"], maxLength: 100 },
    autoReorderEnabled: { type: "boolean" },
  },
} as const;

const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    materialId: { type: "string", maxLength: 100 },
    entryType: { type: "string", enum: materialLogBody.properties.entryType.enum },
    limit: { type: "integer", minimum: 1, maximum: 200 },
    before: { type: "string", maxLength: 40 },
  },
} as const;


const reportEmailBody = {
  type: "object",
  additionalProperties: false,
  properties: { email: { type: "string", format: "email", maxLength: 320 } },
} as const;

const materialsLedgerRoutes: FastifyPluginAsync = async (fastify) => {
  const service = buildMaterialsLedgerService(fastify.db, fastify.queue);

  const reports = materialReportService(fastify.db, {
    ledger: service,
    files: filesService(filesRepository(fastify.db)),
  });

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/materials/stock",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "view");
      return service.getStock(project.id);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/materials/catalog",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "view");
      return service.getCatalog(project.id);
    },
  );

  fastify.put<{ Params: { id: string; materialId: string }; Body: ReorderPolicyInput }>(
    "/projects/:id/materials/catalog/:materialId/reorder-policy",
    { schema: { params: materialIdParams, body: reorderPolicyBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "manage");
      return service.updateReorderPolicy(project.id, request.params.materialId, request.body);
    },
  );

  fastify.get<{ Params: { id: string }; Querystring: { materialId?: string; entryType?: "IN" | "USED"; limit?: number; before?: string } }>(
    "/projects/:id/materials/ledger",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "view");
      return service.listLedger(project.id, request.query);
    },
  );

  fastify.post<{ Params: { id: string }; Body: LogEntryInput }>(
    "/projects/:id/materials/ledger",
    { schema: { params: projectIdParams, body: materialLogBody } },
    async (request, reply) => {
      const project = await requireMaterialLogPermission(request, request.params.id, request.body.entryType);
      const user = request.requireAuth();
      const result = await service.logEntry(project.id, request.body, user.id);
      return reply.status(result.duplicate ? 200 : 201).send(result);
    },
  );

  fastify.post<{ Params: { id: string; entryId: string }; Body: { reason: string } }>(
    "/projects/:id/materials/ledger/:entryId/void",
    { schema: { params: entryParams, body: voidLedgerBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "manage");
      const user = request.requireAuth();
      const entry = await service.voidEntry(project.id, request.params.entryId, request.body.reason, user.id);
      return reply.status(201).send(entry);
    },
  );

  fastify.post<{ Params: { id: string; entryId: string } }>(
    "/projects/:id/materials/ledger/:entryId/approve",
    { schema: { params: entryParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "manage");
      const user = request.requireAuth();
      const entry = await service.approveEntry(project.id, request.params.entryId, user.id);
      return reply.send(entry);
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
