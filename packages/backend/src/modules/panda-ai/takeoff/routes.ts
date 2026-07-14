import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { config } from "../../../config/index.ts";
import { BadRequestError, NotFoundError } from "../../../lib/errors.ts";
import { openStoredFile, saveStream } from "../../../lib/file-storage.ts";
import { preconRepository } from "./repository.ts";
import { proposalsRepository } from "../../proposals/repository.ts";
import { filesRepository } from "../../files/repository.ts";
import { proposalsService } from "../../proposals/service.ts";
import { preconService } from "./service.ts";
import { PRECON_GENERATE_QUEUE, type PreconGenerateJobData } from "./job.ts";
import { GEOMETRY_KINDS } from "./types.ts";
import type { AddDeductionBody, PreconSummarySettings, UpdateGeometryBody, UpdateRowBody } from "./types.ts";

const sessionParams = {
  type: "object",
  required: ["sessionId"],
  additionalProperties: false,
  properties: { sessionId: { type: "string", minLength: 1 } },
} as const;

const sheetParams = {
  type: "object",
  required: ["sheetId"],
  additionalProperties: false,
  properties: { sheetId: { type: "string", minLength: 1 } },
} as const;

const rowParams = {
  type: "object",
  required: ["rowId"],
  additionalProperties: false,
  properties: { rowId: { type: "string", minLength: 1 } },
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
  properties: {
    title: { type: "string", maxLength: 200 },
    proposalId: { type: "string", maxLength: 100 },
  },
} as const;

const listSessionsQuery = {
  type: "object",
  additionalProperties: false,
  properties: { proposalId: { type: "string", maxLength: 100 } },
} as const;

const fromPlanBody = {
  type: "object",
  required: ["proposalId", "planId"],
  additionalProperties: false,
  properties: {
    proposalId: { type: "string", minLength: 1 },
    planId: { type: "string", minLength: 1 },
  },
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

// Preconstruction lives in the sales suite: every route is organization-scoped
// (bids usually precede a project). Reads need org membership; writes need the
// proposals org permission, mirroring the proposals module.
const preconRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: { fileSize: config.uploads.maxFileBytes, files: 10 },
  });

  const repo = preconRepository(fastify.db);
  const service = preconService(repo, (sessionId, event) => {
    fastify.realtime.publish({ event: event.type, channelId: `precon:${sessionId}`, data: event });
  });

  fastify.post<{ Querystring: { title?: string; proposalId?: string } }>(
    "/precon/sessions",
    { schema: { querystring: createSessionQuery } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "create");
      const proposalId = request.query.proposalId ?? null;
      if (proposalId) {
        const proposal = await proposalsRepository(fastify.db).getById(proposalId, orgId);
        if (!proposal) throw new NotFoundError("Proposal");
      }
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
        orgId,
        request.query.title ?? files[0]!.fileName,
        user.id,
        files,
        proposalId,
      );
      const jobData: PreconGenerateJobData = { sessionId: session.id };
      await fastify.queue.enqueue(PRECON_GENERATE_QUEUE, "generate", jobData);
      return reply.status(202).send(session);
    },
  );

  // Measure a plan already uploaded to the proposal — no re-upload; the
  // session reuses the plan's stored file.
  fastify.post<{ Body: { proposalId: string; planId: string } }>(
    "/precon/sessions/from-plan",
    { schema: { body: fromPlanBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "create");
      const proposalsRepo = proposalsRepository(fastify.db);
      const proposal = await proposalsRepo.getById(request.body.proposalId, orgId);
      if (!proposal) throw new NotFoundError("Proposal");
      const plans = await proposalsRepo.listPlans(request.body.proposalId);
      const plan = plans.find((p) => p.id === request.body.planId);
      if (!plan) throw new NotFoundError("Plan");
      if (!/\.(pdf|dwg)$/i.test(plan.fileName)) {
        throw new BadRequestError("Panda AI can measure PDF or DWG drawings only");
      }
      const file = await filesRepository(fastify.db).findById(plan.fileId);
      if (!file) throw new NotFoundError("Plan file");
      const session = await service.createSession(
        orgId,
        plan.fileName,
        user.id,
        [{ fileName: file.file_name, storagePath: file.storage_path }],
        request.body.proposalId,
      );
      const jobData: PreconGenerateJobData = { sessionId: session.id };
      await fastify.queue.enqueue(PRECON_GENERATE_QUEUE, "generate", jobData);
      return reply.status(202).send(session);
    },
  );

  fastify.get<{ Querystring: { proposalId?: string } }>(
    "/precon/sessions",
    { schema: { querystring: listSessionsQuery } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgScope();
      return service.listSessions(orgId, request.query.proposalId);
    },
  );

  fastify.get<{ Params: { sessionId: string } }>(
    "/precon/sessions/:sessionId",
    { schema: { params: sessionParams } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgScope();
      await service.assertSessionOrg(request.params.sessionId, orgId);
      return service.getSnapshot(request.params.sessionId);
    },
  );

  fastify.patch<{ Params: { rowId: string }; Body: UpdateRowBody }>(
    "/precon/rows/:rowId",
    { schema: { params: rowParams, body: updateRowBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "update");
      await service.assertRowOrg(request.params.rowId, orgId);
      return service.updateRow(request.params.rowId, request.body, user.id);
    },
  );

  fastify.post<{ Params: { rowId: string }; Body: { version: number } }>(
    "/precon/rows/:rowId/verify",
    { schema: { params: rowParams, body: versionOnlyBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "update");
      await service.assertRowOrg(request.params.rowId, orgId);
      return service.verifyRow(request.params.rowId, request.body.version, user.id);
    },
  );

  fastify.post<{ Params: { rowId: string }; Body: { version: number } }>(
    "/precon/rows/:rowId/reject",
    { schema: { params: rowParams, body: versionOnlyBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "update");
      await service.assertRowOrg(request.params.rowId, orgId);
      return service.rejectRow(request.params.rowId, request.body.version, user.id);
    },
  );

  fastify.put<{ Params: { rowId: string }; Body: UpdateGeometryBody }>(
    "/precon/rows/:rowId/geometry",
    { schema: { params: rowParams, body: updateGeometryBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "update");
      await service.assertRowOrg(request.params.rowId, orgId);
      return service.updateGeometry(request.params.rowId, request.body, user.id);
    },
  );

  fastify.post<{ Params: { rowId: string }; Body: AddDeductionBody }>(
    "/precon/rows/:rowId/deductions",
    { schema: { params: rowParams, body: addDeductionBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "update");
      await service.assertRowOrg(request.params.rowId, orgId);
      return service.addDeduction(request.params.rowId, request.body, user.id);
    },
  );

  fastify.patch<{ Params: { sessionId: string }; Body: Partial<PreconSummarySettings> }>(
    "/precon/sessions/:sessionId/settings",
    { schema: { params: sessionParams, body: settingsBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "update");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      return service.updateSettings(request.params.sessionId, request.body, user.id);
    },
  );

  fastify.get<{ Params: { sheetId: string } }>(
    "/precon/sheets/:sheetId/file",
    { schema: { params: sheetParams } },
    async (request, reply) => {
      request.requireAuth();
      const orgId = request.requireOrgScope();
      const sheet = await repo.sheetById(request.params.sheetId);
      if (!sheet) throw new NotFoundError("Sheet");
      await service.assertSessionOrg(sheet.session_id, orgId);
      const stream = await openStoredFile(sheet.storage_path);
      return reply.header("content-type", "application/pdf").send(stream);
    },
  );

  fastify.get<{ Params: { sheetId: string } }>(
    "/precon/sheets/:sheetId/snap",
    { schema: { params: sheetParams } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgScope();
      const sheet = await repo.sheetById(request.params.sheetId);
      if (!sheet) throw new NotFoundError("Sheet");
      await service.assertSessionOrg(sheet.session_id, orgId);
      return { points: sheet.snap_index ?? [] };
    },
  );

  fastify.get<{ Params: { sessionId: string } }>(
    "/precon/sessions/:sessionId/export.xlsx",
    { schema: { params: sessionParams } },
    async (request, reply) => {
      request.requireAuth();
      const orgId = request.requireOrgScope();
      await service.assertSessionOrg(request.params.sessionId, orgId);
      const { fileName, buffer } = await service.exportWorkbook(request.params.sessionId);
      return reply
        .header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("content-disposition", `attachment; filename="${fileName}"`)
        .send(buffer);
    },
  );

  fastify.post<{ Params: { sessionId: string } }>(
    "/precon/sessions/:sessionId/apply-to-proposal",
    { schema: { params: sessionParams } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "create");
      const session = await service.assertSessionOrg(request.params.sessionId, orgId);
      const snapshot = await service.getSnapshot(request.params.sessionId);
      let proposalId = session.proposalId;
      if (!proposalId) {
        const proposals = proposalsService(proposalsRepository(fastify.db));
        const proposal = await proposals.createProposal(orgId, user.id, {
          title: session.title,
          clientName: session.title,
          brief: `Generated from preconstruction session ${session.id}`,
        });
        proposalId = proposal.id;
        await service.linkToProposal(session.id, proposalId);
      }
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
      await proposalsRepository(fastify.db).replaceBoqItems(proposalId, items);
      return reply.status(201).send({ proposalId, itemCount: items.length });
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
