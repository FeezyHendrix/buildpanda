import type { FastifyPluginAsync } from "fastify";
import { proposalsRepository } from "./repository.ts";
import { proposalsService } from "./service.ts";
import { PROPOSAL_STATUSES } from "./types.ts";
import { ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import type {
  CreateProposalInput,
  CreateEstimateItemInput,
  CreatePaymentScheduleInput,
} from "./types.ts";

const idParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
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

const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: PROPOSAL_STATUSES },
    limit: { type: "integer", minimum: 1, maximum: 100 },
    offset: { type: "integer", minimum: 0 },
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

function requireOrgAccess(request: Parameters<FastifyPluginAsync>[0]["addHook"] extends (name: string, fn: (req: infer R) => unknown) => unknown ? R : never) {
  void request;
}

const proposalRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = proposalsRepository(fastify.db);
  const service = proposalsService(repo);

  function orgScope(request: { requireAuth: () => unknown; activeOrganizationId: string | null; orgRoles: ReadonlyMap<string, string> }) {
    request.requireAuth();
    const orgId = request.activeOrganizationId;
    if (!orgId || !request.orgRoles.has(orgId)) throw new ForbiddenError("No active organization");
    return orgId;
  }

  // --- Proposals ---

  fastify.get<{ Querystring: { status?: string; limit?: number; offset?: number } }>(
    "/proposals",
    { schema: { querystring: listQuery } },
    async (request) => {
      const orgId = orgScope(request);
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
      const orgId = orgScope(request);
      const user = request.requireAuth();
      const proposal = await service.createProposal(orgId, user.id, request.body);
      return reply.status(201).send(proposal);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/proposals/:id",
    { schema: { params: idParams } },
    async (request) => {
      const orgId = orgScope(request);
      const workspace = await service.getWorkspace(request.params.id, orgId);
      if (!workspace) throw new NotFoundError("Proposal");
      return workspace;
    },
  );

  fastify.patch<{ Params: { id: string }; Body: Partial<CreateProposalInput & { status: string; validUntil: string | null }> }>(
    "/proposals/:id",
    { schema: { params: idParams, body: patchProposalBody } },
    async (request) => {
      const orgId = orgScope(request);
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
      const orgId = orgScope(request);
      await repo.deleteProposal(request.params.id, orgId);
      return reply.status(204).send();
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/proposals/:id/events",
    { schema: { params: idParams } },
    async (request) => {
      const orgId = orgScope(request);
      const exists = await repo.getById(request.params.id, orgId);
      if (!exists) throw new NotFoundError("Proposal");
      return repo.listEvents(request.params.id);
    },
  );

  // --- Estimates ---

  fastify.post<{ Params: { id: string }; Body: { changeNote?: string } }>(
    "/proposals/:id/estimates",
    { schema: { params: idParams, body: createRevisionBody } },
    async (request, reply) => {
      const orgId = orgScope(request);
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
      const orgId = orgScope(request);
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
      const orgId = orgScope(request);
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
      const orgId = orgScope(request);
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
};

// Remove unused import reference
void requireOrgAccess;

export default proposalRoutes;
