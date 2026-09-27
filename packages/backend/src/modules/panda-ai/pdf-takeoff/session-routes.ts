import type { FastifyPluginAsync } from "fastify";
import { BadRequestError, NotFoundError } from "../../../lib/errors.ts";
import { saveStream } from "../../../lib/file-storage.ts";
import { estimateItemsService } from "../../proposals/estimate-items-service.ts";
import { proposalsRepository } from "../../proposals/repository.ts";
import { filesRepository } from "../../files/repository.ts";
import { proposalsService } from "../../proposals/service.ts";
import type { preconService } from "./service.ts";
import { PRECON_GENERATE_QUEUE, type PreconGenerateJobData } from "./job.ts";
import { TAKEOFF_QUEUE, type TakeoffJobData } from "../dwg-takeoff/job.ts";
import { FULL_TAKEOFF_SCOPE, PICTURE_PLAN } from "./types.ts";
import type {
  CreateBlankSessionBody,
  CreateSessionFromPlanBody,
  PreconSummarySettings,
} from "./types.ts";
import {
  blankSessionBody,
  createSessionQuery,
  fromPlanBody,
  listSessionsQuery,
  sessionParams,
  settingsBody,
} from "./route-schemas.ts";

interface SessionRoutesOptions {
  service: ReturnType<typeof preconService>;
}

// Opening, listing, reading and closing out a take-off session: the upload,
// the plan already on the proposal, the retry, the snapshot and the exports.
export const sessionRoutes: FastifyPluginAsync<SessionRoutesOptions> = async (fastify, { service }) => {
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
        const proposals = proposalsService(proposalsRepository(fastify.db), estimateItemsService(fastify.db));
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
