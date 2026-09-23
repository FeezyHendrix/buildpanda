// Estimates, sending them, the client conversation and the conversion.
//
// Split from `routes.ts` at the house 400-line ceiling. The proposal itself and
// its bill of quantities stay there; everything downstream of "the numbers are
// agreed" lives here. It is a sibling plugin rather than a nested one so the two
// register independently and neither can shadow the other's prefixes.

import type { FastifyPluginAsync } from "fastify";
import { estimateItemsService } from "./estimate-items-service.ts";
import { proposalsRepository } from "./repository.ts";
import { proposalsService } from "./service.ts";
import { proposalTermsRepository } from "./terms-repository.ts";
import { proposalTermsService } from "./terms-service.ts";
import { proposalSendService } from "./send-service.ts";
import { convertProposalToProject, previewConversion } from "./convert-to-project.ts";
import {
  CLIENT_VISIBLE_DETAIL,
  CONVERT_SECTIONS,
  RETENTION_MODES,
  SCHEDULE_KINDS,
  WHT_RATES,
} from "./types.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { idParams } from "../../lib/schemas.ts";
import { sendEmail } from "../../lib/mail.ts";
import { proposalSentEmail } from "../../lib/email-templates.ts";
import { generateId } from "../../lib/ids.ts";
import { config } from "../../config/index.ts";
import type { ConvertBody, CreateEstimateItemInput, CreatePaymentScheduleInput, UpdateEstimateTermsInput } from "./types.ts";

const convertBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    include: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(CONVERT_SECTIONS.map((key) => [key, { type: "boolean" }])),
    },
  },
} as const;

const proposalEstimateParams = {
  type: "object",
  properties: {
    id: { type: "string", minLength: 1 },
    estimateId: { type: "string", minLength: 1 },
  },
  required: ["id", "estimateId"],
  additionalProperties: false,
} as const;

const createRevisionBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    changeNote: { type: "string", maxLength: 500 },
  },
} as const;

const estimateItemSchema = {
  type: "object",
  required: ["groupLabel", "description", "qty", "unit", "unitRate"],
  additionalProperties: false,
  properties: {
    groupLabel: { type: "string", minLength: 1, maxLength: 100 },
    description: { type: "string", minLength: 1, maxLength: 500 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    qty: { type: "number", minimum: 0 },
    unit: { type: "string", minLength: 1, maxLength: 50 },
    unitRate: { type: "number", minimum: 0 },
    boqItemId: { type: ["string", "null"], maxLength: 100 },
    takeoffSessionId: { type: ["string", "null"], maxLength: 100 },
    sort: { type: "integer", minimum: 0 },
  },
} as const;

const scheduleItemSchema = {
  type: "object",
  required: ["label", "percent"],
  additionalProperties: false,
  properties: {
    label: { type: "string", minLength: 1, maxLength: 200 },
    percent: { type: "number", minimum: 0, maximum: 100 },
    description: { type: "string", maxLength: 500 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    sort: { type: "integer", minimum: 0 },
    kind: { type: "string", enum: SCHEDULE_KINDS },
    programmeTaskId: { type: ["string", "null"], maxLength: 100 },
  },
} as const;

const termsBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    retentionPct: { type: ["number", "null"], minimum: 0, maximum: 100 },
    retentionMode: { type: ["string", "null"], enum: [...RETENTION_MODES, null] },
    advancePct: { type: ["number", "null"], minimum: 0, maximum: 100 },
    whtPct: { type: ["number", "null"], enum: [...WHT_RATES, null] },
    paymentTermsDays: { type: ["integer", "null"], minimum: 0, maximum: 365 },
    defectsLiabilityDays: { type: ["integer", "null"], minimum: 0, maximum: 3650 },
    clientVisibleDetail: { type: "string", enum: CLIENT_VISIBLE_DETAIL },
    validUntil: { type: ["string", "null"], maxLength: 30 },
  },
} as const;

const patchEstimateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    contingencyPct: { type: "number", minimum: 0, maximum: 100 },
    taxLabel: { type: "string", maxLength: 50 },
    taxPct: { type: "number", minimum: 0, maximum: 100 },
  },
} as const;

const estimateRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = proposalsRepository(fastify.db);
  const estimates = estimateItemsService(fastify.db);
  const service = proposalsService(repo, estimates);
  const termsRepo = proposalTermsRepository(fastify.db);
  const termsService = proposalTermsService(repo, estimates);
  const sendService = proposalSendService(fastify.db, repo, termsRepo, termsService, estimates);

  // --- Estimates ---

  fastify.post<{ Params: { id: string }; Body: { changeNote?: string } }>(
    "/proposals/:id/estimates",
    { schema: { params: idParams, body: createRevisionBody } },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("proposals", "create");
      const user = request.requireAuth();

      // Pull org defaults for tax
      const org = await fastify.db("organization")
        .where({ id: orgId })
        .select("default_tax_label", "default_tax_pct")
        .first();

      const estimate = await service.createEstimateRevision(
        request.params.id,
        orgId,
        user.id,
        {
          changeNote: request.body.changeNote,
          orgTaxLabel: org?.default_tax_label ?? "VAT",
          orgTaxPct: Number(org?.default_tax_pct ?? 0),
        },
      );
      return reply.status(201).send(estimate);
    },
  );

  fastify.put<{ Params: { id: string; estimateId: string }; Body: CreateEstimateItemInput[] }>(
    "/proposals/:id/estimates/:estimateId/items",
    {
      schema: {
        params: proposalEstimateParams,
        body: { type: "array", items: estimateItemSchema, maxItems: 500 } as const,
      },
    },
    async (request) => {
      const orgId = request.requireOrgPermission("proposals", "update");
      return service.saveEstimateItems(
        request.params.estimateId,
        request.params.id,
        orgId,
        request.body,
      );
    },
  );

  fastify.put<{ Params: { id: string; estimateId: string }; Body: CreatePaymentScheduleInput[] }>(
    "/proposals/:id/estimates/:estimateId/payment-schedule",
    {
      schema: {
        params: proposalEstimateParams,
        body: { type: "array", items: scheduleItemSchema, maxItems: 100 } as const,
      },
    },
    async (request) => {
      const orgId = request.requireOrgPermission("estimates", "terms");
      return termsService.savePaymentSchedule(
        request.params.estimateId,
        request.params.id,
        orgId,
        request.body,
      );
    },
  );

  // Money terms live on the revision the client signs.
  fastify.patch<{ Params: { id: string; estimateId: string }; Body: UpdateEstimateTermsInput }>(
    "/proposals/:id/estimates/:estimateId/terms",
    { schema: { params: proposalEstimateParams, body: termsBody } },
    async (request) => {
      const orgId = request.requireOrgPermission("estimates", "terms");
      const estimate = await termsService.updateTerms(
        request.params.estimateId,
        request.params.id,
        orgId,
        request.body,
      );
      const [items, schedule] = await Promise.all([repo.getItems(estimate.id), repo.getSchedule(estimate.id)]);
      return { ...estimate, items, schedule };
    },
  );

  fastify.patch<{
    Params: { id: string; estimateId: string };
    Body: { contingencyPct?: number; taxLabel?: string; taxPct?: number };
  }>(
    "/proposals/:id/estimates/:estimateId",
    { schema: { params: proposalEstimateParams, body: patchEstimateBody } },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("proposals", "update");
      await service.updateEstimateMeta(
        request.params.estimateId,
        request.params.id,
        orgId,
        request.body,
      );
      const estimate = await repo.getEstimate(request.params.estimateId);
      if (!estimate) throw new NotFoundError("Estimate");
      const [items, schedule] = await Promise.all([
        repo.getItems(estimate.id),
        repo.getSchedule(estimate.id),
      ]);
      return reply.send({ ...estimate, items, schedule });
    },
  );

  // --- Send estimate ---

  fastify.post<{ Params: { id: string; estimateId: string } }>(
    "/proposals/:id/estimates/:estimateId/send",
    { schema: { params: proposalEstimateParams } },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("proposals", "send");
      const user = request.requireAuth();

      const proposal = await repo.getById(request.params.id, orgId);
      if (!proposal) throw new NotFoundError("Proposal");

      const sent = await sendService.send(request.params.id, request.params.estimateId, orgId, user.id);
      const token = sent.token;
      const shareUrl = `${config.mail.appUrl}/p/${token}`;

      // Send email to client if we have their address
      if (proposal.client_email) {
        const org = await fastify.db("organization").where({ id: orgId }).select("name").first();
        const tpl = proposalSentEmail({
          clientName: proposal.client_name,
          companyName: (org?.name as string | undefined) ?? "Your contractor",
          proposalTitle: proposal.title,
          proposalNumber: `BP-${String(proposal.number).padStart(4, "0")}`,
          shareUrl,
          validUntil: proposal.valid_until
            ? new Date(proposal.valid_until).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : undefined,
        });
        void sendEmail({ to: proposal.client_email, toName: proposal.client_name, ...tpl }).catch(
          (err) => fastify.log.error({ err }, "Failed to send proposal sent email"),
        );
      }

      return reply.status(200).send({ shareUrl, token, snapshotFileId: sent.snapshotFileId, pdfHash: sent.pdfHash });
    },
  );

  // --- Comments ---

  fastify.get<{ Params: { id: string } }>(
    "/proposals/:id/comments",
    { schema: { params: idParams } },
    async (request) => {
      const orgId = request.requireOrgScope();
      const proposal = await repo.getById(request.params.id, orgId);
      if (!proposal) throw new NotFoundError("Proposal");
      return repo.listComments(request.params.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: { body: string } }>(
    "/proposals/:id/comments",
    {
      schema: {
        params: idParams,
        body: {
          type: "object",
          required: ["body"],
          additionalProperties: false,
          properties: { body: { type: "string", minLength: 1, maxLength: 5000 } },
        } as const,
      },
    },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("proposals", "update");
      const user = request.requireAuth();
      const proposal = await repo.getById(request.params.id, orgId);
      if (!proposal) throw new NotFoundError("Proposal");

      const comment = await repo.insertComment({
        id: generateId("cmt"),
        proposalId: request.params.id,
        authorId: user.id,
        authorName: user.name ?? user.email ?? "Unknown",
        body: request.body.body,
      });
      return reply.status(201).send(comment);
    },
  );

  // --- Convert proposal → construction project ---

  // What conversion would create, section by section, so the user confirms
  // with counts in front of them rather than a generic "are you sure".
  fastify.post<{ Params: { id: string } }>(
    "/proposals/:id/convert/preview",
    { schema: { params: idParams } },
    async (request) => {
      const orgId = request.requireOrgPermission("proposals", "convert");
      const user = request.requireAuth();
      return previewConversion({ db: fastify.db, repo }, { proposalId: request.params.id, orgId, userId: user.id });
    },
  );

  fastify.post<{ Params: { id: string }; Body: ConvertBody }>(
    "/proposals/:id/convert",
    { schema: { params: idParams, body: convertBody } },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("proposals", "convert");
      const user = request.requireAuth();

      const result = await convertProposalToProject(
        { db: fastify.db, repo, log: request.log },
        { proposalId: request.params.id, orgId, user, include: request.body?.include },
      );
      return reply
        .status(result.created ? 201 : 200)
        .send({ projectId: result.projectId, clientInvited: result.clientInvited });
    },
  );
};

export default estimateRoutes;
