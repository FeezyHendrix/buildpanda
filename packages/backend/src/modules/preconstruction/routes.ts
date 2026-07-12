import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { config } from "../../config/index.ts";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { openStoredFile, saveStream } from "../../lib/file-storage.ts";
import { preconRepository } from "./repository.ts";
import { proposalsRepository } from "../proposals/repository.ts";
import { proposalsService } from "../proposals/service.ts";
import { preconService } from "./service.ts";
import { PRECON_GENERATE_QUEUE, type PreconGenerateJobData } from "./job.ts";
import { GEOMETRY_KINDS } from "./types.ts";
import type { AddDeductionBody, PreconSummarySettings, UpdateGeometryBody, UpdateRowBody } from "./types.ts";

const idParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

const sessionParams = {
  type: "object",
  required: ["id", "sessionId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    sessionId: { type: "string", minLength: 1 },
  },
} as const;

const sheetParams = {
  type: "object",
  required: ["id", "sheetId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    sheetId: { type: "string", minLength: 1 },
  },
} as const;

const rowParams = {
  type: "object",
  required: ["id", "rowId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    rowId: { type: "string", minLength: 1 },
  },
} as const;

const updateRowBody = {
  type: "object",
  required: ["version", "changes"],
  additionalProperties: false,
  properties: {
    version: { type: "integer", minimum: 1 },
    changes: {
      type: "object",
      additionalProperties: false,
      minProperties: 1,
      properties: {
        description: { type: "string", maxLength: 4000 },
        qty: { type: "number", minimum: 0 },
        rate: { type: "number", minimum: 0 },
        unit: { type: "string", maxLength: 20 },
      },
    },
  },
} as const;

const versionOnlyBody = {
  type: "object",
  required: ["version"],
  additionalProperties: false,
  properties: { version: { type: "integer", minimum: 1 } },
} as const;

const vertices = {
  type: "array",
  minItems: 1,
  maxItems: 2000,
  items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } },
} as const;

const updateGeometryBody = {
  type: "object",
  required: ["version", "kind", "vertices"],
  additionalProperties: false,
  properties: {
    version: { type: "integer", minimum: 1 },
    kind: { type: "string", enum: GEOMETRY_KINDS },
    vertices,
  },
} as const;

const addDeductionBody = {
  type: "object",
  required: ["version", "label", "vertices"],
  additionalProperties: false,
  properties: {
    version: { type: "integer", minimum: 1 },
    label: { type: "string", minLength: 1, maxLength: 200 },
    vertices,
  },
} as const;

const createSessionQuery = {
  type: "object",
  additionalProperties: false,
  properties: { title: { type: "string", maxLength: 200 } },
} as const;

const settingsBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    prelimsPct: { type: "number", minimum: 0, maximum: 100 },
    contingencyPct: { type: "number", minimum: 0, maximum: 100 },
    vatPct: { type: "number", minimum: 0, maximum: 100 },
  },
} as const;

const rateCardBody = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    region: { type: ["string", "null"], maxLength: 120 },
  },
} as const;

const cardParams = {
  type: "object",
  required: ["cardId"],
  additionalProperties: false,
  properties: { cardId: { type: "string", minLength: 1 } },
} as const;

const rateParams = {
  type: "object",
  required: ["cardId", "rateId"],
  additionalProperties: false,
  properties: {
    cardId: { type: "string", minLength: 1 },
    rateId: { type: "string", minLength: 1 },
  },
} as const;

const rateBody = {
  type: "object",
  required: ["unit", "rate"],
  additionalProperties: false,
  properties: {
    codePrefix: { type: ["string", "null"], maxLength: 20 },
    descriptionPattern: { type: ["string", "null"], maxLength: 400 },
    unit: { type: "string", minLength: 1, maxLength: 20 },
    rate: { type: "number", minimum: 0 },
  },
} as const;

const preconRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: { fileSize: config.uploads.maxFileBytes, files: 10 },
  });

  const service = preconService(preconRepository(fastify.db), (sessionId, event) => {
    fastify.realtime.publish({ event: event.type, channelId: `precon:${sessionId}`, data: event });
  });

  fastify.post<{ Params: { id: string }; Querystring: { title?: string } }>(
    "/projects/:id/precon/sessions",
    { schema: { params: idParams, querystring: createSessionQuery } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "request");
      const user = request.requireAuth();
      const files: { fileName: string; storagePath: string }[] = [];
      for await (const part of request.files()) {
        if (!/\.(pdf|dwg)$/i.test(part.filename)) {
          throw new BadRequestError("Preconstruction accepts PDF or DWG drawings");
        }
        const stored = await saveStream(user.id, part.file);
        files.push({ fileName: part.filename, storagePath: stored.storagePath });
      }
      if (files.length === 0) throw new BadRequestError("No drawing files uploaded");
      const session = await service.createSession(
        project.id,
        request.query.title ?? files[0]!.fileName,
        user.id,
        files,
      );
      const jobData: PreconGenerateJobData = { sessionId: session.id };
      await fastify.queue.enqueue(PRECON_GENERATE_QUEUE, "generate", jobData);
      return reply.status(202).send(session);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/precon/sessions",
    { schema: { params: idParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "project", "view");
      return service.listSessions(project.id);
    },
  );

  fastify.get<{ Params: { id: string; sessionId: string } }>(
    "/projects/:id/precon/sessions/:sessionId",
    { schema: { params: sessionParams } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "project", "view");
      return service.getSnapshot(request.params.sessionId);
    },
  );

  fastify.patch<{ Params: { id: string; rowId: string }; Body: UpdateRowBody }>(
    "/projects/:id/precon/rows/:rowId",
    { schema: { params: rowParams, body: updateRowBody } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "materials", "request");
      const user = request.requireAuth();
      return service.updateRow(request.params.rowId, request.body, user.id);
    },
  );

  fastify.post<{ Params: { id: string; rowId: string }; Body: { version: number } }>(
    "/projects/:id/precon/rows/:rowId/verify",
    { schema: { params: rowParams, body: versionOnlyBody } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "materials", "request");
      const user = request.requireAuth();
      return service.verifyRow(request.params.rowId, request.body.version, user.id);
    },
  );

  fastify.post<{ Params: { id: string; rowId: string }; Body: { version: number } }>(
    "/projects/:id/precon/rows/:rowId/reject",
    { schema: { params: rowParams, body: versionOnlyBody } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "materials", "request");
      const user = request.requireAuth();
      return service.rejectRow(request.params.rowId, request.body.version, user.id);
    },
  );

  fastify.put<{ Params: { id: string; rowId: string }; Body: UpdateGeometryBody }>(
    "/projects/:id/precon/rows/:rowId/geometry",
    { schema: { params: rowParams, body: updateGeometryBody } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "materials", "request");
      const user = request.requireAuth();
      return service.updateGeometry(request.params.rowId, request.body, user.id);
    },
  );

  fastify.post<{ Params: { id: string; rowId: string }; Body: AddDeductionBody }>(
    "/projects/:id/precon/rows/:rowId/deductions",
    { schema: { params: rowParams, body: addDeductionBody } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "materials", "request");
      const user = request.requireAuth();
      return service.addDeduction(request.params.rowId, request.body, user.id);
    },
  );

  fastify.patch<{ Params: { id: string; sessionId: string }; Body: Partial<PreconSummarySettings> }>(
    "/projects/:id/precon/sessions/:sessionId/settings",
    { schema: { params: sessionParams, body: settingsBody } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "materials", "request");
      const user = request.requireAuth();
      return service.updateSettings(request.params.sessionId, request.body, user.id);
    },
  );

  fastify.get<{ Params: { id: string; sheetId: string } }>(
    "/projects/:id/precon/sheets/:sheetId/file",
    { schema: { params: sheetParams } },
    async (request, reply) => {
      await request.requireProjectPermission(request.params.id, "project", "view");
      const sheet = await preconRepository(fastify.db).sheetById(request.params.sheetId);
      if (!sheet) throw new NotFoundError("Sheet");
      const stream = await openStoredFile(sheet.storage_path);
      return reply.header("content-type", "application/pdf").send(stream);
    },
  );

  fastify.get<{ Params: { id: string; sheetId: string } }>(
    "/projects/:id/precon/sheets/:sheetId/snap",
    { schema: { params: sheetParams } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "project", "view");
      const sheet = await preconRepository(fastify.db).sheetById(request.params.sheetId);
      if (!sheet) throw new NotFoundError("Sheet");
      return { points: sheet.snap_index ?? [] };
    },
  );

  fastify.get<{ Params: { id: string; sessionId: string } }>(
    "/projects/:id/precon/sessions/:sessionId/export.xlsx",
    { schema: { params: sessionParams } },
    async (request, reply) => {
      await request.requireProjectPermission(request.params.id, "project", "view");
      const { fileName, buffer } = await service.exportWorkbook(request.params.sessionId);
      return reply
        .header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("content-disposition", `attachment; filename="${fileName}"`)
        .send(buffer);
    },
  );

  fastify.post<{ Params: { id: string; sessionId: string } }>(
    "/projects/:id/precon/sessions/:sessionId/send-to-proposals",
    { schema: { params: sessionParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "request");
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "create");
      const snapshot = await service.getSnapshot(request.params.sessionId);
      const proposals = proposalsService(proposalsRepository(fastify.db));
      const proposal = await proposals.createProposal(orgId, user.id, {
        title: snapshot.session.title,
        clientName: (project as { name?: string }).name ?? snapshot.session.title,
        brief: `Generated from preconstruction session ${snapshot.session.id}`,
      });
      // BOQ copy uses the proposals module's own repository method — the
      // proposals service does not expose BOQ item writes yet.
      const items = snapshot.rows
        .filter((r) => (r.rowType === "item" || r.rowType === "provisional_sum") && r.status !== "rejected")
        .map((r, idx) => ({
          groupLabel: r.elementGroup ?? "General",
          description: r.description,
          qty: r.qty ?? 0,
          unit: r.unit ?? "item",
          sort: idx,
        }));
      await proposalsRepository(fastify.db).replaceBoqItems(proposal.id, items);
      return reply.status(201).send({ proposalId: proposal.id, itemCount: items.length });
    },
  );

  // ---- org-scoped rates library ----

  fastify.get("/precon/rate-cards", async (request) => {
    request.requireAuth();
    const orgId = request.requireOrgScope();
    return service.listRateCards(orgId);
  });

  fastify.post<{ Body: { name: string; region?: string | null } }>(
    "/precon/rate-cards",
    { schema: { body: rateCardBody } },
    async (request, reply) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "create");
      const card = await service.createRateCard(orgId, request.body.name, request.body.region ?? null);
      return reply.status(201).send(card);
    },
  );

  fastify.post<{
    Params: { cardId: string };
    Body: { codePrefix?: string | null; descriptionPattern?: string | null; unit: string; rate: number };
  }>(
    "/precon/rate-cards/:cardId/rates",
    { schema: { params: cardParams, body: rateBody } },
    async (request, reply) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "update");
      const rate = await service.addRate(orgId, request.params.cardId, {
        codePrefix: request.body.codePrefix ?? null,
        descriptionPattern: request.body.descriptionPattern ?? null,
        unit: request.body.unit,
        rate: request.body.rate,
      });
      return reply.status(201).send(rate);
    },
  );

  fastify.delete<{ Params: { cardId: string; rateId: string } }>(
    "/precon/rate-cards/:cardId/rates/:rateId",
    { schema: { params: rateParams } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "update");
      return service.removeRate(orgId, request.params.cardId, request.params.rateId);
    },
  );
};

export default preconRoutes;
