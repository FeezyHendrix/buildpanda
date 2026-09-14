import type { FastifyPluginAsync } from "fastify";
import { proposalsRepository } from "./repository.ts";
import { proposalsService } from "./service.ts";
import { PLAN_DISCIPLINES } from "./types.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { idParams } from "../../lib/schemas.ts";
import type { CreateProposalPlanInput, UpdateProposalPlanInput } from "./types.ts";

const proposalPlanParams = {
  type: "object",
  required: ["id", "planId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    planId: { type: "string", minLength: 1 },
  },
} as const;

const createPlanBody = {
  type: "object",
  required: ["fileId"],
  additionalProperties: false,
  properties: {
    fileId: { type: "string", minLength: 1, maxLength: 100 },
    label: { type: "string", maxLength: 200 },
    sheetCode: { type: "string", maxLength: 40 },
    discipline: { type: "string", enum: PLAN_DISCIPLINES },
    revision: { type: "string", maxLength: 20 },
  },
} as const;

const updatePlanBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    label: { type: ["string", "null"], maxLength: 200 },
    sheetCode: { type: ["string", "null"], maxLength: 40 },
    discipline: { type: ["string", "null"], enum: [...PLAN_DISCIPLINES, null] },
    revision: { type: ["string", "null"], maxLength: 20 },
  },
} as const;


const planRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = proposalsRepository(fastify.db);
  const service = proposalsService(repo);

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

  fastify.post<{ Params: { id: string }; Body: CreateProposalPlanInput }>(
    "/proposals/:id/plans",
    { schema: { params: idParams, body: createPlanBody } },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("proposals", "update");
      const user = request.requireAuth();
      const file = await fastify.db("uploaded_files")
        .where({ id: request.body.fileId, owner_id: user.id })
        .first();
      if (!file) throw new NotFoundError("File");
      const plans = await service.addPlan(request.params.id, orgId, user.id, request.body);
      return reply.status(201).send(plans);
    },
  );

  fastify.patch<{ Params: { id: string; planId: string }; Body: UpdateProposalPlanInput }>(
    "/proposals/:id/plans/:planId",
    { schema: { params: proposalPlanParams, body: updatePlanBody } },
    async (request) => {
      const orgId = request.requireOrgPermission("proposals", "update");
      return service.updatePlan(request.params.id, orgId, request.params.planId, request.body);
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

};

export default planRoutes;
