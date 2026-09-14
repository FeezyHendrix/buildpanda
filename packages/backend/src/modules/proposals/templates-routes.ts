import type { FastifyPluginAsync } from "fastify";
import { proposalsRepository } from "./repository.ts";
import { proposalsService } from "./service.ts";
import { proposalTemplatesRepository } from "./templates-repository.ts";
import { proposalTemplatesService } from "./templates-service.ts";
import type { CreateFromTemplateInput, SaveTemplateInput } from "./types.ts";

const templateParams = {
  type: "object",
  required: ["templateId"],
  additionalProperties: false,
  properties: { templateId: { type: "string", minLength: 1 } },
} as const;

const saveBody = {
  type: "object",
  required: ["proposalId", "name"],
  additionalProperties: false,
  properties: {
    proposalId: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1, maxLength: 120 },
  },
} as const;

const renameBody = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: { name: { type: "string", minLength: 1, maxLength: 120 } },
} as const;

const fromTemplateBody = {
  type: "object",
  required: ["templateId", "title", "clientName"],
  additionalProperties: false,
  properties: {
    templateId: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1, maxLength: 200 },
    clientName: { type: "string", minLength: 1, maxLength: 200 },
    clientEmail: { type: "string", maxLength: 320 },
    clientPhone: { type: "string", maxLength: 50 },
    location: { type: "string", maxLength: 500 },
    brief: { type: "string", maxLength: 5000 },
    currency: { type: "string", minLength: 3, maxLength: 3 },
    validUntil: { type: "string", maxLength: 40 },
    leadId: { type: "string", maxLength: 100 },
  },
} as const;

// Registered before the proposal routes; the static /proposals/templates and
// /proposals/from-template paths take precedence over /proposals/:id anyway.
const proposalTemplateRoutes: FastifyPluginAsync = async (fastify) => {
  const proposalsRepo = proposalsRepository(fastify.db);
  const proposals = proposalsService(proposalsRepo);
  const service = proposalTemplatesService(proposalTemplatesRepository(fastify.db), proposalsRepo, {
    createProposal: (orgId, userId, input) => proposals.createProposal(orgId, userId, input),
    createEstimateRevision: (proposalId, orgId, userId, opts) =>
      proposals.createEstimateRevision(proposalId, orgId, userId, opts),
  });

  fastify.get("/proposals/templates", async (request) => {
    request.requireAuth();
    const orgId = request.requireOrgPermission("proposals", "view");
    return service.list(orgId);
  });

  fastify.post<{ Body: SaveTemplateInput }>(
    "/proposals/templates",
    { schema: { body: saveBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "update");
      const template = await service.saveFromProposal(orgId, user.id, request.body);
      return reply.status(201).send(template);
    },
  );

  fastify.patch<{ Params: { templateId: string }; Body: { name: string } }>(
    "/proposals/templates/:templateId",
    { schema: { params: templateParams, body: renameBody } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "update");
      return service.rename(orgId, request.params.templateId, request.body.name);
    },
  );

  fastify.delete<{ Params: { templateId: string } }>(
    "/proposals/templates/:templateId",
    { schema: { params: templateParams } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "delete");
      return service.remove(orgId, request.params.templateId);
    },
  );

  fastify.post<{ Body: CreateFromTemplateInput }>(
    "/proposals/from-template",
    { schema: { body: fromTemplateBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "create");
      const result = await service.createProposalFromTemplate(orgId, user.id, request.body);
      return reply.status(201).send(result);
    },
  );
};

export default proposalTemplateRoutes;
