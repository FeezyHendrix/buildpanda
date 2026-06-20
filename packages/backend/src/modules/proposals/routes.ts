import { randomBytes } from "crypto";
import type { CurrencyCode } from "../../lib/currencies.ts";
import type { FastifyPluginAsync } from "fastify";
import { proposalsRepository } from "./repository.ts";
import { proposalsService } from "./service.ts";
import { PROPOSAL_STATUSES } from "./types.ts";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { idParams, paginationProperties } from "../../lib/schemas.ts";
import { sendEmail } from "../../lib/mail.ts";
import { proposalSentEmail } from "../../lib/email-templates.ts";
import { generateId } from "../../lib/ids.ts";
import { config } from "../../config/index.ts";
import type {
  CreateProposalInput,
  CreateEstimateItemInput,
  CreatePaymentScheduleInput,
} from "./types.ts";

const DEFAULT_PHASES = [
  { name: "Site Survey & Soil Testing", date_range: "Weeks 1 – 2" },
  { name: "Permitting & Approvals", date_range: "Weeks 3 – 8" },
  { name: "Foundation & Substructure", date_range: "Weeks 9 – 16" },
  { name: "Superstructure & MEP", date_range: "Weeks 17 – 32" },
  { name: "Finishing", date_range: "Weeks 33 – 42" },
  { name: "External Works", date_range: "Weeks 43 – 46" },
  { name: "Testing & Handover", date_range: "Weeks 47 – 48" },
] as const;

const proposalEstimateParams = {
  type: "object",
  properties: {
    id: { type: "string", minLength: 1 },
    estimateId: { type: "string", minLength: 1 },
  },
  required: ["id", "estimateId"],
  additionalProperties: false,
} as const;

const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: PROPOSAL_STATUSES },
    ...paginationProperties,
  },
} as const;

const createProposalBody = {
  type: "object",
  required: ["title", "clientName"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    clientName: { type: "string", minLength: 1, maxLength: 200 },
    clientEmail: { type: "string", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", maxLength: 320 },
    clientPhone: { type: "string", maxLength: 50 },
    location: { type: "string", maxLength: 200 },
    brief: { type: "string", maxLength: 5000 },
    currency: { type: "string", maxLength: 10 },
    validUntil: { type: "string", maxLength: 30 },
    leadId: { type: "string", maxLength: 100 },
  },
} as const;

const patchProposalBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    clientName: { type: "string", minLength: 1, maxLength: 200 },
    clientEmail: { type: ["string", "null"], maxLength: 320 },
    clientPhone: { type: ["string", "null"], maxLength: 50 },
    location: { type: ["string", "null"], maxLength: 200 },
    brief: { type: ["string", "null"], maxLength: 5000 },
    status: { type: "string", enum: PROPOSAL_STATUSES },
    currency: { type: "string", maxLength: 10 },
    validUntil: { type: ["string", "null"], maxLength: 30 },
  },
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
    boqItemId: { type: "string", maxLength: 100 },
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

const proposalRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = proposalsRepository(fastify.db);
  const service = proposalsService(repo);

  // --- Proposals ---

  fastify.get<{ Querystring: { status?: string; limit?: number; offset?: number } }>(
    "/proposals",
    { schema: { querystring: listQuery } },
    async (request) => {
      const orgId = request.requireOrgScope();
      return repo.listByOrg(orgId, {
        status: request.query.status,
        limit: request.query.limit ?? 25,
        offset: request.query.offset ?? 0,
      });
    },
  );

  fastify.post<{ Body: CreateProposalInput }>(
    "/proposals",
    { schema: { body: createProposalBody } },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("proposals", "create");
      const user = request.requireAuth();
      const proposal = await service.createProposal(orgId, user.id, request.body);
      return reply.status(201).send(proposal);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/proposals/:id",
    { schema: { params: idParams } },
    async (request) => {
      const orgId = request.requireOrgScope();
      const workspace = await service.getWorkspace(request.params.id, orgId);
      if (!workspace) throw new NotFoundError("Proposal");
      return workspace;
    },
  );

  fastify.patch<{ Params: { id: string }; Body: Partial<CreateProposalInput & { status: string; validUntil: string | null }> }>(
    "/proposals/:id",
    { schema: { params: idParams, body: patchProposalBody } },
    async (request) => {
      const orgId = request.requireOrgPermission("proposals", "update");
      const { id } = request.params;
      const updated = await repo.updateProposal(id, orgId, {
        title: request.body.title,
        clientName: request.body.clientName,
        clientEmail: request.body.clientEmail as string | null | undefined,
        clientPhone: request.body.clientPhone as string | null | undefined,
        location: request.body.location as string | null | undefined,
        brief: request.body.brief as string | null | undefined,
        status: request.body.status as import("./types.ts").ProposalStatus | undefined,
        currency: request.body.currency,
        validUntil: (request.body as { validUntil?: string | null }).validUntil,
      });
      if (!updated) throw new NotFoundError("Proposal");
      return repo.toProposal(updated);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/proposals/:id",
    { schema: { params: idParams } },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("proposals", "delete");
      await repo.deleteProposal(request.params.id, orgId);
      return reply.status(204).send();
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/proposals/:id/events",
    { schema: { params: idParams } },
    async (request) => {
      const orgId = request.requireOrgScope();
      const exists = await repo.getById(request.params.id, orgId);
      if (!exists) throw new NotFoundError("Proposal");
      return repo.listEvents(request.params.id);
    },
  );

  // --- Plans ---

  fastify.get<{ Params: { id: string } }>(
    "/proposals/:id/plans",
    { schema: { params: idParams } },
    async (request) => {
      const orgId = request.requireOrgScope();
      const exists = await repo.getById(request.params.id, orgId);
      if (!exists) throw new NotFoundError("Proposal");
      return repo.listPlans(request.params.id);
    },
  );

  fastify.post<{
    Params: { id: string };
    Body: { fileId: string; label?: string };
  }>(
    "/proposals/:id/plans",
    {
      schema: {
        params: idParams,
        body: {
          type: "object",
          required: ["fileId"],
          additionalProperties: false,
          properties: {
            fileId: { type: "string", minLength: 1, maxLength: 100 },
            label: { type: "string", maxLength: 200 },
          },
        } as const,
      },
    },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("proposals", "update");
      const user = request.requireAuth();
      const exists = await repo.getById(request.params.id, orgId);
      if (!exists) throw new NotFoundError("Proposal");

      const file = await fastify.db("uploaded_files")
        .where({ id: request.body.fileId, owner_id: user.id })
        .first();
      if (!file) throw new NotFoundError("File");

      const existing = await repo.listPlans(request.params.id);
      await repo.insertPlan({
        id: generateId("plan"),
        proposalId: request.params.id,
        fileId: request.body.fileId,
        label: request.body.label?.trim() || null,
        uploadedBy: user.id,
        sort: existing.length,
      });

      const plans = await repo.listPlans(request.params.id);
      return reply.status(201).send(plans);
    },
  );

  fastify.delete<{ Params: { id: string; planId: string } }>(
    "/proposals/:id/plans/:planId",
    {
      schema: {
        params: {
          type: "object",
          required: ["id", "planId"],
          additionalProperties: false,
          properties: {
            id: { type: "string", minLength: 1 },
            planId: { type: "string", minLength: 1 },
          },
        } as const,
      },
    },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("proposals", "update");
      const exists = await repo.getById(request.params.id, orgId);
      if (!exists) throw new NotFoundError("Proposal");
      const removed = await repo.deletePlan(request.params.planId, request.params.id);
      if (removed === 0) throw new NotFoundError("Plan");
      return reply.status(204).send();
    },
  );

  // --- BoQ items ---

  fastify.get<{ Params: { id: string } }>(
    "/proposals/:id/boq",
    { schema: { params: idParams } },
    async (request) => {
      const orgId = request.requireOrgScope();
      const exists = await repo.getById(request.params.id, orgId);
      if (!exists) throw new NotFoundError("Proposal");
      return repo.listBoqItems(request.params.id);
    },
  );

  fastify.put<{
    Params: { id: string };
    Body: Array<{
      groupLabel: string;
      description: string;
      qty: number;
      unit: string;
      sort?: number;
    }>;
  }>(
    "/proposals/:id/boq",
    {
      schema: {
        params: idParams,
        body: {
          type: "array",
          items: {
            type: "object",
            required: ["groupLabel", "description", "qty", "unit"],
            additionalProperties: false,
            properties: {
              groupLabel: { type: "string", minLength: 1, maxLength: 100 },
              description: { type: "string", minLength: 1, maxLength: 500 },
              descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
              qty: { type: "number", minimum: 0 },
              unit: { type: "string", minLength: 1, maxLength: 50 },
              sort: { type: "integer", minimum: 0 },
            },
          },
        } as const,
      },
    },
    async (request) => {
      const orgId = request.requireOrgPermission("proposals", "update");
      const exists = await repo.getById(request.params.id, orgId);
      if (!exists) throw new NotFoundError("Proposal");
      await repo.replaceBoqItems(request.params.id, request.body);
      return repo.listBoqItems(request.params.id);
    },
  );

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
      const orgId = request.requireOrgPermission("proposals", "update");
      return service.savePaymentSchedule(
        request.params.estimateId,
        request.params.id,
        orgId,
        request.body,
      );
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

      const estimate = await repo.getEstimate(request.params.estimateId);
      if (!estimate || estimate.proposalId !== request.params.id) throw new NotFoundError("Estimate");
      if (estimate.status !== "Draft") {
        throw new ForbiddenError("Only Draft estimates can be sent.");
      }

      // Generate share token — valid until proposal.valid_until or 30 days
      const token = randomBytes(32).toString("hex");
      const expiresAt = proposal.valid_until
        ? new Date(proposal.valid_until).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await repo.setShareToken(request.params.estimateId, token, expiresAt);
      await repo.updateEstimateMeta(request.params.estimateId, {
        status: "Sent",
        sentAt: new Date().toISOString(),
      });
      await repo.updateProposal(request.params.id, orgId, { status: "Sent" });
      await repo.logEvent(request.params.id, "estimate_sent", user.id, {
        estimateId: estimate.id,
        revisionNo: estimate.revisionNo,
      });

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

      return reply.status(200).send({ shareUrl, token });
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

  fastify.post<{ Params: { id: string } }>(
    "/proposals/:id/convert",
    { schema: { params: idParams } },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("proposals", "convert");
      const user = request.requireAuth();

      const proposalRow = await repo.getById(request.params.id, orgId);
      if (!proposalRow) throw new NotFoundError("Proposal");
      if (proposalRow.status !== "Accepted") {
        throw new BadRequestError("Only Accepted proposals can be converted.");
      }
      if (proposalRow.project_id) {
        // Already converted — return the existing project id
        return reply.send({ projectId: proposalRow.project_id });
      }

      const estimate = await repo.getActiveEstimate(request.params.id);
      const schedule = estimate ? await repo.getSchedule(estimate.id) : [];

      // projects.currency only accepts NGN | USD
      const currency: CurrencyCode =
        proposalRow.currency === "USD" ? "USD" : "NGN";

      const projectId = generateId("prj");
      const now = new Date().toISOString();

      await fastify.db.transaction(async (trx) => {
        await trx("projects").insert({
          id: projectId,
          owner_id: user.id,
          organization_id: orgId,
          name: proposalRow.title,
          address: proposalRow.location ?? "To be confirmed",
          status: "On Track",
          health_score: 0,
          risk: "Low",
          progress_percent: 0,
          budget_total: estimate?.total ?? 0,
          budget_used: 0,
          currency,
          pending_approvals: 0,
          folder_tone: "orange",
          budget_min: estimate?.total ?? 0,
          budget_max: estimate?.total ?? 0,
          setup: {
            projectType: "Residential",
            location: { state: "", city: proposalRow.location ?? "", ownsLand: false },
            buildingType: "House",
            timeline: "12 months",
            fundingMethod: "Self",
            involvementLevel: "Hands-on",
            riskOptions: [],
          },
        });

        await trx("project_phases").insert(
          DEFAULT_PHASES.map((phase, idx) => ({
            id: generateId("phase"),
            project_id: projectId,
            name: phase.name,
            status: "Pending",
            date_range: phase.date_range,
            sort_order: idx,
          })),
        );

        await trx("project_finances").insert({
          project_id: projectId,
          currency,
          total_budget: estimate?.total ?? 0,
          funds_deposited: 0,
          funds_released: 0,
          locked_in_escrow: 0,
          remaining_balance: estimate?.total ?? 0,
        });

        if (schedule.length > 0 && estimate) {
          await trx("milestone_payments").insert(
            schedule.map((s, idx) => ({
              id: generateId("mlst"),
              project_id: projectId,
              name: s.label,
              phase: "General",
              status: "Pending",
              percent_complete: 0,
              amount: Math.round((estimate.total * s.percent) / 100 * 100) / 100,
              proof_file_name: null,
              proof_verified: false,
              inspector_sign_off: "Pending",
              sort_order: idx,
            })),
          );
        }

        await trx("project_documents").insert({
          id: generateId("doc"),
          project_id: projectId,
          category_id: "cat_proposal",
          file_id: null,
          file_name: `Proposal BP-${String(proposalRow.number).padStart(4, "0")} — snapshot`,
          size: "—",
          size_bytes: null,
          status: "Verified",
          uploaded_at: now,
        });

        await trx("proposals")
          .where({ id: request.params.id })
          .update({ project_id: projectId, status: "Converted", updated_at: now });

        await trx("proposal_events").insert({
          id: generateId("evt"),
          proposal_id: request.params.id,
          type: "converted",
          actor: user.id,
          metadata: { projectId },
          created_at: now,
        });
      });

      return reply.status(201).send({ projectId });
    },
  );
};

export default proposalRoutes;
