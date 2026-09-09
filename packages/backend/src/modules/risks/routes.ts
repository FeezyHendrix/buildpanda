import type { FastifyPluginAsync } from "fastify";
import { idParams } from "../../lib/schemas.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { chatJsonValidated } from "../../lib/llm.ts";
import { risksRepository } from "./repository.ts";
import { risksService } from "./service.ts";
import { buildProposalDraftContext } from "./draft-context.ts";
import { RISK_IMPACTS, RISK_LIKELIHOODS, RISK_STATUSES, type CreateRiskInput, type EditRiskInput } from "./types.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { proposalsRepository } from "../proposals/repository.ts";

const riskParams = {
  type: "object",
  required: ["id", "riskId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    riskId: { type: "string", minLength: 1 },
  },
} as const;

const severitySchema = { type: "string", enum: ["Low", "Medium", "High"] } as const;
const nullableLevel = (values: readonly string[]) => ({ type: ["string", "null"], enum: [...values, null] }) as const;

const riskFields = {
  title: { type: "string", minLength: 1, maxLength: 200 },
  description: { type: "string", minLength: 1, maxLength: 2000 },
  descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
  severity: severitySchema,
  likelihood: nullableLevel(RISK_LIKELIHOODS),
  impact: nullableLevel(RISK_IMPACTS),
  ownerId: { type: ["string", "null"], maxLength: 100 },
  ownerName: { type: ["string", "null"], maxLength: 120 },
  mitigation: { type: ["string", "null"], maxLength: 2000 },
  status: { type: "string", enum: RISK_STATUSES },
  reviewDate: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
} as const;

const createRiskBody = {
  type: "object",
  required: ["title", "description"],
  additionalProperties: false,
  properties: riskFields,
} as const;

const editRiskBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: riskFields,
} as const;

const riskRoutes: FastifyPluginAsync = async (fastify) => {
  const service = risksService(risksRepository(fastify.db), {
    db: fastify.db,
    notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue),
    draft: chatJsonValidated,
  });
  const proposals = proposalsRepository(fastify.db);

  async function requireProposal(id: string, orgId: string): Promise<void> {
    const proposal = await proposals.getById(id, orgId);
    if (!proposal) throw new NotFoundError("Proposal");
  }

  // ---- project scope ----
  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/risk-factors",
    { schema: { params: idParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "risks", "view");
      return service.listByProject(project.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateRiskInput }>(
    "/projects/:id/risk-factors",
    { schema: { params: idParams, body: createRiskBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "risks", "manage");
      return reply.status(201).send(await service.create(project.id, request.body));
    },
  );

  fastify.put<{ Params: { id: string; riskId: string }; Body: EditRiskInput }>(
    "/projects/:id/risk-factors/:riskId",
    { schema: { params: riskParams, body: editRiskBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "risks", "manage");
      return service.edit(project.id, request.params.riskId, request.body);
    },
  );

  fastify.post<{ Params: { id: string; riskId: string } }>(
    "/projects/:id/risk-factors/:riskId/confirm",
    { schema: { params: riskParams } },
    async (request) => {
      const user = request.requireAuth();
      const project = await request.requireProjectPermission(request.params.id, "risks", "manage");
      return service.confirm({ projectId: project.id }, request.params.riskId, user.id);
    },
  );

  fastify.delete<{ Params: { id: string; riskId: string } }>(
    "/projects/:id/risk-factors/:riskId",
    { schema: { params: riskParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "risks", "manage");
      await service.remove(project.id, request.params.riskId);
      return reply.status(204).send();
    },
  );

  // ---- proposal scope (pre-construction register) ----
  // Reuses the proposals permission for now; a dedicated resource can replace
  // "update" here once the safety pack has its own grants.
  fastify.get<{ Params: { id: string } }>(
    "/proposals/:id/risks",
    { schema: { params: idParams } },
    async (request) => {
      const orgId = request.requireOrgPermission("proposals", "view");
      await requireProposal(request.params.id, orgId);
      return service.listByProposal(request.params.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateRiskInput }>(
    "/proposals/:id/risks",
    { schema: { params: idParams, body: createRiskBody } },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("proposals", "update");
      await requireProposal(request.params.id, orgId);
      return reply.status(201).send(await service.createForProposal(request.params.id, request.body));
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/proposals/:id/risks/draft",
    { schema: { params: idParams } },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("proposals", "update");
      const ctx = await buildProposalDraftContext(fastify.db, request.params.id, orgId);
      return reply.status(201).send(await service.draftForProposal(request.params.id, ctx));
    },
  );

  fastify.put<{ Params: { id: string; riskId: string }; Body: EditRiskInput }>(
    "/proposals/:id/risks/:riskId",
    { schema: { params: riskParams, body: editRiskBody } },
    async (request) => {
      const orgId = request.requireOrgPermission("proposals", "update");
      await requireProposal(request.params.id, orgId);
      return service.editForProposal(request.params.id, request.params.riskId, request.body);
    },
  );

  fastify.post<{ Params: { id: string; riskId: string } }>(
    "/proposals/:id/risks/:riskId/confirm",
    { schema: { params: riskParams } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "update");
      await requireProposal(request.params.id, orgId);
      return service.confirm({ proposalId: request.params.id }, request.params.riskId, user.id);
    },
  );

  fastify.delete<{ Params: { id: string; riskId: string } }>(
    "/proposals/:id/risks/:riskId",
    { schema: { params: riskParams } },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("proposals", "update");
      await requireProposal(request.params.id, orgId);
      await service.removeForProposal(request.params.id, request.params.riskId);
      return reply.status(204).send();
    },
  );
};

export default riskRoutes;
