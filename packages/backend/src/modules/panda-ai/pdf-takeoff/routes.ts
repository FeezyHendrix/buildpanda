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
import {
  PRECON_GENERATE_QUEUE,
  PRECON_PROGRAMME_QUEUE,
  type PreconGenerateJobData,
  type PreconProgrammeJobData,
} from "./job.ts";
import { FULL_TAKEOFF_SCOPE, GEOMETRY_KINDS, ROW_TYPES, TAKEOFF_MODES, TAKEOFF_SCOPE_KINDS, PICTURE_CONTENT_TYPE, PICTURE_PLAN } from "./types.ts";
import { TAKEOFF_QUEUE, type TakeoffJobData } from "../dwg-takeoff/job.ts";
import applyToEstimateRoutes from "./apply-to-estimate-routes.ts";
import { reviewRoutes } from "./review-routes.ts";
import { manualRoutes } from "./manual-routes.ts";
import { sheetGeometryRoutes } from "./sheet-geometry-routes.ts";
import { assemblyMeasurementRoutes } from "./assembly-routes.ts";
import { presenceRoutes } from "./presence-routes.ts";
import { staleLookupFromPlans } from "./stale.ts";
import { plansRepository } from "../../proposals/plans-repository.ts";
import { BESMM_ELEMENT_ORDER } from "./engine/besmm-reference.ts";
import type {
  AddDeductionBody,
  CreateBillBody,
  CreateBlankSessionBody,
  CreateProgrammeTaskBody,
  CreateSessionFromPlanBody,
  CreateRowBody,
  PreconSummarySettings,
  UpdateBillBody,
  UpdateGeometryBody,
  UpdateProgrammeTaskBody,
  UpdateRowBody,
} from "./types.ts";

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

const taskParams = {
  type: "object",
  required: ["taskId"],
  additionalProperties: false,
  properties: { taskId: { type: "string", minLength: 1 } },
} as const;

const programmeStartBody = {
  type: "object",
  required: ["startDate"],
  additionalProperties: false,
  properties: { startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } },
} as const;

const programmeLink = {
  type: "object",
  required: ["taskId", "type"],
  additionalProperties: false,
  properties: {
    taskId: { type: "string", minLength: 1 },
    type: { type: "string", enum: ["FS", "SS", "FF", "SF"] },
    lagDays: { type: "number", minimum: -60, maximum: 60, default: 0 },
  },
} as const;

const updateProgrammeTaskBody = {
  type: "object",
  required: ["version"],
  additionalProperties: false,
  minProperties: 2,
  properties: {
    version: { type: "integer", minimum: 1 },
    name: { type: "string", minLength: 1, maxLength: 120 },
    durationDays: { type: "number", minimum: 0, maximum: 400 },
    isMilestone: { type: "boolean" },
    basis: { type: "string", maxLength: 200 },
    outlineLevel: { type: "integer", minimum: 1, maximum: 5 },
    sort: { type: "integer", minimum: 0 },
    predecessors: { type: "array", maxItems: 20, items: programmeLink },
  },
} as const;

const createProgrammeTaskBody = {
  type: "object",
  required: ["name", "durationDays"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    durationDays: { type: "number", minimum: 0, maximum: 400 },
    isMilestone: { type: "boolean" },
    basis: { type: "string", maxLength: 200 },
    outlineLevel: { type: "integer", minimum: 1, maximum: 5 },
    afterTaskId: { type: "string", minLength: 1 },
    predecessors: { type: "array", maxItems: 20, items: programmeLink },
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
        typical: { type: "integer", minimum: 1, maximum: 500 },
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
    sheetId: { type: "string", minLength: 1, maxLength: 100 },
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
    sheetId: { type: "string", minLength: 1, maxLength: 100 },
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

const billParams = {
  type: "object",
  required: ["billId"],
  additionalProperties: false,
  properties: { billId: { type: "string", minLength: 1 } },
} as const;

const blankSessionBody = {
  type: "object",
  required: ["title"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    proposalId: { type: "string", maxLength: 100 },
  },
} as const;

const billBody = {
  type: "object",
  required: ["title"],
  additionalProperties: false,
  properties: { title: { type: "string", minLength: 1, maxLength: 200 } },
} as const;

const createRowBody = {
  type: "object",
  required: ["description"],
  additionalProperties: false,
  properties: {
    rowType: { type: "string", enum: ROW_TYPES },
    description: { type: "string", minLength: 1, maxLength: 4000 },
    elementGroup: { type: "string", maxLength: 200 },
    code: { type: "string", maxLength: 40 },
    unit: { type: "string", maxLength: 20 },
    qty: { type: "number", minimum: 0 },
    rate: { type: "number", minimum: 0 },
  },
} as const;

const fromPlanBody = {
  type: "object",
  required: ["proposalId", "planId"],
  additionalProperties: false,
  properties: {
    proposalId: { type: "string", minLength: 1 },
    planId: { type: "string", minLength: 1 },
    mode: { type: "string", enum: TAKEOFF_MODES },
    scope: {
      type: "object",
      required: ["kind", "elements"],
      additionalProperties: false,
      properties: {
        kind: { type: "string", enum: TAKEOFF_SCOPE_KINDS },
        elements: { type: "array", maxItems: 20, items: { type: "string", enum: BESMM_ELEMENT_ORDER } },
      },
    },
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

// Preconstruction lives in the sales suite: every route is organization-scoped
// (bids usually precede a project). Reads need org membership; writes need the
// proposals org permission, mirroring the proposals module.
const pdfTakeoffRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: { fileSize: config.uploads.maxFileBytes, files: 10 },
  });

  const repo = preconRepository(fastify.db);
  const service = preconService(
    repo,
    (sessionId, event) => {
      fastify.realtime.publish({ event: event.type, channelId: `precon:${sessionId}`, data: event });
    },
    staleLookupFromPlans(plansRepository(fastify.db)),
  );

  fastify.post<{ Querystring: { title?: string; proposalId?: string } }>(
    "/precon/sessions",
    { schema: { querystring: createSessionQuery } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "measure");
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
      const jobData: PreconGenerateJobData = { sessionId: session.id, orgId };
      await fastify.queue.enqueue(PRECON_GENERATE_QUEUE, "generate", jobData);
      return reply.status(202).send(session);
    },
  );

  // Measure a plan already uploaded to the proposal — no re-upload; the
  // session reuses the plan's stored file.
  fastify.post<{ Body: CreateSessionFromPlanBody }>(
    "/precon/sessions/from-plan",
    { schema: { body: fromPlanBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "measure");
      const proposalsRepo = proposalsRepository(fastify.db);
      const proposal = await proposalsRepo.getById(request.body.proposalId, orgId);
      if (!proposal) throw new NotFoundError("Proposal");
      const plans = await proposalsRepo.listPlans(request.body.proposalId);
      const plan = plans.find((p) => p.id === request.body.planId);
      if (!plan) throw new NotFoundError("Plan");
      const picture = PICTURE_PLAN.test(plan.fileName);
      if (!/\.(pdf|dwg)$/i.test(plan.fileName) && !(picture && request.body.mode === "manual")) {
        throw new BadRequestError(
          picture ? "Panda AI cannot measure a picture; open it with Measure by hand instead" : "Panda AI can measure PDF or DWG drawings only",
        );
      }
      const file = await filesRepository(fastify.db).findById(plan.fileId);
      if (!file) throw new NotFoundError("Plan file");
      // Measured by hand: the sheets are rendered (PDF pages) or registered
      // (DWG drawings) by the same jobs, in sheets-only mode; no engine lines.
      if (request.body.mode === "manual") {
        const manual = await service.createManualSession(
          orgId,
          user.id,
          request.body.proposalId,
          plan.id,
          { fileName: file.file_name, storagePath: file.storage_path },
          request.body.scope ?? FULL_TAKEOFF_SCOPE,
        );
        if (picture) {
          // nothing to render: the picture is the sheet, calibrated by hand
        } else if (/\.dwg$/i.test(file.file_name)) {
          const dwgJob: TakeoffJobData = { sessionId: manual.id, orgId, sheetsOnly: true };
          await fastify.queue.enqueue(TAKEOFF_QUEUE, "takeoff", dwgJob);
        } else {
          const pdfJob: PreconGenerateJobData = { sessionId: manual.id, orgId, sheetsOnly: true };
          await fastify.queue.enqueue(PRECON_GENERATE_QUEUE, "generate", pdfJob);
        }
        return reply.status(202).send(manual);
      }
      const session = await service.createSession(
        orgId,
        plan.fileName,
        user.id,
        [{ fileName: file.file_name, storagePath: file.storage_path }],
        request.body.proposalId,
        request.body.scope,
        { planId: plan.id, takeoffKind: "pdf" },
      );
      const jobData: PreconGenerateJobData = { sessionId: session.id, orgId };
      await fastify.queue.enqueue(PRECON_GENERATE_QUEUE, "generate", jobData);
      return reply.status(202).send(session);
    },
  );

  fastify.post<{ Params: { sessionId: string } }>(
    "/precon/sessions/:sessionId/retry",
    { schema: { params: sessionParams } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "measure");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      const session = await service.retryGeneration(request.params.sessionId, user.id);
      const jobData: PreconGenerateJobData = { sessionId: session.id, orgId };
      await fastify.queue.enqueue(PRECON_GENERATE_QUEUE, "generate", jobData);
      return reply.status(202).send(session);
    },
  );

  await fastify.register(reviewRoutes, { service });
  await fastify.register(manualRoutes, { service });
  await fastify.register(sheetGeometryRoutes, { service });
  await fastify.register(assemblyMeasurementRoutes, { service, repo });
  await fastify.register(presenceRoutes, { service });

  fastify.post<{ Body: CreateBlankSessionBody }>(
    "/precon/sessions/blank",
    { schema: { body: blankSessionBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "measure");
      const proposalId = request.body.proposalId ?? null;
      if (proposalId) {
        const proposal = await proposalsRepository(fastify.db).getById(proposalId, orgId);
        if (!proposal) throw new NotFoundError("Proposal");
      }
      const session = await service.createBlankSession(orgId, request.body.title, user.id, proposalId);
      return reply.status(201).send(session);
    },
  );

  fastify.post<{ Params: { sessionId: string }; Body: CreateBillBody }>(
    "/precon/sessions/:sessionId/bills",
    { schema: { params: sessionParams, body: billBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      const bill = await service.createBill(request.params.sessionId, request.body.title, user.id);
      return reply.status(201).send(bill);
    },
  );

  fastify.patch<{ Params: { billId: string }; Body: UpdateBillBody }>(
    "/precon/bills/:billId",
    { schema: { params: billParams, body: billBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertBillOrg(request.params.billId, orgId);
      return service.renameBill(request.params.billId, request.body.title, user.id);
    },
  );

  fastify.delete<{ Params: { billId: string } }>(
    "/precon/bills/:billId",
    { schema: { params: billParams } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertBillOrg(request.params.billId, orgId);
      return service.removeBill(request.params.billId, user.id);
    },
  );

  fastify.post<{ Params: { billId: string }; Body: CreateRowBody }>(
    "/precon/bills/:billId/rows",
    { schema: { params: billParams, body: createRowBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertBillOrg(request.params.billId, orgId);
      const row = await service.createRow(request.params.billId, request.body, user.id);
      return reply.status(201).send(row);
    },
  );

  fastify.delete<{ Params: { rowId: string } }>(
    "/precon/rows/:rowId",
    { schema: { params: rowParams } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertRowOrg(request.params.rowId, orgId);
      return service.removeRow(request.params.rowId, user.id);
    },
  );

  fastify.get<{ Querystring: { proposalId?: string } }>(
    "/precon/sessions",
    { schema: { querystring: listSessionsQuery } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      return service.listSessions(orgId, request.query.proposalId);
    },
  );

  fastify.get<{ Params: { sessionId: string } }>(
    "/precon/sessions/:sessionId",
    { schema: { params: sessionParams } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      return service.getSnapshot(request.params.sessionId);
    },
  );

  // ── Programme of work ──────────────────────────────────────────────────────

  fastify.post<{ Params: { sessionId: string } }>(
    "/precon/sessions/:sessionId/programme",
    { schema: { params: sessionParams } },
    async (request, reply) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "measure");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      await fastify.queue.enqueue(PRECON_PROGRAMME_QUEUE, "programme", {
        sessionId: request.params.sessionId,
        orgId,
      } satisfies PreconProgrammeJobData);
      return reply.status(202).send({ status: "queued" });
    },
  );

  fastify.get<{ Params: { sessionId: string } }>(
    "/precon/sessions/:sessionId/programme",
    { schema: { params: sessionParams } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      return service.getProgramme(request.params.sessionId);
    },
  );

  fastify.patch<{ Params: { sessionId: string }; Body: { startDate: string } }>(
    "/precon/sessions/:sessionId/programme/start",
    { schema: { params: sessionParams, body: programmeStartBody } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      return service.setProgrammeStart(request.params.sessionId, request.body.startDate);
    },
  );

  fastify.post<{ Params: { sessionId: string }; Body: CreateProgrammeTaskBody }>(
    "/precon/sessions/:sessionId/programme/tasks",
    { schema: { params: sessionParams, body: createProgrammeTaskBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      const task = await service.createProgrammeTask(request.params.sessionId, request.body, user.id);
      return reply.status(201).send(task);
    },
  );

  fastify.delete<{ Params: { taskId: string } }>(
    "/precon/programme-tasks/:taskId",
    { schema: { params: taskParams } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertProgrammeTaskOrg(request.params.taskId, orgId);
      return service.deleteProgrammeTask(request.params.taskId, user.id);
    },
  );

  fastify.get<{ Params: { sessionId: string } }>(
    "/precon/sessions/:sessionId/programme/export.xml",
    { schema: { params: sessionParams } },
    async (request, reply) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      const { fileName, xml } = await service.exportProgrammeXml(request.params.sessionId);
      return reply
        .header("content-type", "application/xml; charset=utf-8")
        .header("content-disposition", `attachment; filename="${fileName}"`)
        .send(xml);
    },
  );

  fastify.patch<{ Params: { taskId: string }; Body: UpdateProgrammeTaskBody }>(
    "/precon/programme-tasks/:taskId",
    { schema: { params: taskParams, body: updateProgrammeTaskBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertProgrammeTaskOrg(request.params.taskId, orgId);
      const { version, ...patch } = request.body;
      return service.updateProgrammeTask(request.params.taskId, version, patch, user.id);
    },
  );

  fastify.post<{ Params: { taskId: string }; Body: { version: number } }>(
    "/precon/programme-tasks/:taskId/verify",
    { schema: { params: taskParams, body: versionOnlyBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "verify");
      await service.assertProgrammeTaskOrg(request.params.taskId, orgId);
      return service.setProgrammeTaskStatus(request.params.taskId, request.body.version, "verified", user.id);
    },
  );

  fastify.post<{ Params: { taskId: string }; Body: { version: number } }>(
    "/precon/programme-tasks/:taskId/reject",
    { schema: { params: taskParams, body: versionOnlyBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "verify");
      await service.assertProgrammeTaskOrg(request.params.taskId, orgId);
      return service.setProgrammeTaskStatus(request.params.taskId, request.body.version, "rejected", user.id);
    },
  );

  fastify.patch<{ Params: { rowId: string }; Body: UpdateRowBody }>(
    "/precon/rows/:rowId",
    { schema: { params: rowParams, body: updateRowBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertRowOrg(request.params.rowId, orgId);
      return service.updateRow(request.params.rowId, request.body, user.id);
    },
  );

  fastify.post<{ Params: { rowId: string }; Body: { version: number } }>(
    "/precon/rows/:rowId/verify",
    { schema: { params: rowParams, body: versionOnlyBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "verify");
      await service.assertRowOrg(request.params.rowId, orgId);
      return service.verifyRow(request.params.rowId, request.body.version, user.id);
    },
  );

  fastify.post<{ Params: { rowId: string }; Body: { version: number } }>(
    "/precon/rows/:rowId/reject",
    { schema: { params: rowParams, body: versionOnlyBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "verify");
      await service.assertRowOrg(request.params.rowId, orgId);
      return service.rejectRow(request.params.rowId, request.body.version, user.id);
    },
  );

  fastify.put<{ Params: { rowId: string }; Body: UpdateGeometryBody }>(
    "/precon/rows/:rowId/geometry",
    { schema: { params: rowParams, body: updateGeometryBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertRowOrg(request.params.rowId, orgId);
      return service.updateGeometry(request.params.rowId, request.body, user.id);
    },
  );

  fastify.post<{ Params: { rowId: string }; Body: AddDeductionBody }>(
    "/precon/rows/:rowId/deductions",
    { schema: { params: rowParams, body: addDeductionBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertRowOrg(request.params.rowId, orgId);
      return service.addDeduction(request.params.rowId, request.body, user.id);
    },
  );

  fastify.patch<{ Params: { sessionId: string }; Body: Partial<PreconSummarySettings> }>(
    "/precon/sessions/:sessionId/settings",
    { schema: { params: sessionParams, body: settingsBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      return service.updateSettings(request.params.sessionId, request.body, user.id);
    },
  );

  fastify.get<{ Params: { sheetId: string } }>(
    "/precon/sheets/:sheetId/file",
    { schema: { params: sheetParams } },
    async (request, reply) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      const sheet = await repo.sheetById(request.params.sheetId);
      if (!sheet) throw new NotFoundError("Sheet");
      await service.assertSessionOrg(sheet.session_id, orgId);
      const stream = await openStoredFile(sheet.storage_path);
      const ext = sheet.file_name.split(".").pop()?.toLowerCase() ?? "";
      return reply.header("content-type", PICTURE_CONTENT_TYPE[ext] ?? "application/pdf").send(stream);
    },
  );

  fastify.get<{ Params: { sheetId: string } }>(
    "/precon/sheets/:sheetId/snap",
    { schema: { params: sheetParams } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
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
      const orgId = request.requireOrgPermission("takeoffs", "view");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      const { fileName, buffer } = await service.exportWorkbook(request.params.sessionId);
      return reply
        .header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("content-disposition", `attachment; filename="${fileName}"`)
        .send(buffer);
    },
  );

  await fastify.register(applyToEstimateRoutes);

  fastify.post<{ Params: { sessionId: string } }>(
    "/precon/sessions/:sessionId/apply-to-proposal",
    { schema: { params: sessionParams } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "apply");
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

};

export default pdfTakeoffRoutes;
