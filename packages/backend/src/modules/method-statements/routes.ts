import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { idParams } from "../../lib/schemas.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { chatJsonValidated } from "../../lib/llm.ts";
import { proposalsRepository } from "../proposals/repository.ts";
import { buildProposalDraftContext } from "../risks/draft-context.ts";
import { methodStatementsRepository } from "./repository.ts";
import { methodStatementsService } from "./service.ts";
import type { SafetyScope, UpsertMethodStatementInput, UpsertPhasePlanInput } from "./types.ts";

const statementParams = {
  type: "object",
  required: ["id", "statementId"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 }, statementId: { type: "string", minLength: 1 } },
} as const;

const stepSchema = {
  type: "object",
  required: ["text"],
  additionalProperties: false,
  properties: {
    order: { type: "integer", minimum: 0 },
    text: { type: "string", minLength: 1, maxLength: 1000 },
    controls: { type: "string", maxLength: 1000 },
    ppe: { type: "string", maxLength: 400 },
  },
} as const;

const statementBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    activityName: { type: "string", minLength: 1, maxLength: 200 },
    programmeTaskId: { type: ["string", "null"], maxLength: 100 },
    activityId: { type: ["string", "null"], maxLength: 100 },
    hazards: { type: "array", maxItems: 30, items: { type: "string", minLength: 1, maxLength: 300 } },
    steps: { type: "array", maxItems: 40, items: stepSchema },
  },
} as const;

const phasePlanBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    keyDatesNote: { type: ["string", "null"], maxLength: 4000 },
    siteRules: { type: ["string", "null"], maxLength: 8000 },
    welfare: { type: ["string", "null"], maxLength: 4000 },
    firstAid: { type: ["string", "null"], maxLength: 4000 },
    servicesIsolation: { type: ["string", "null"], maxLength: 4000 },
    asbestosNote: { type: ["string", "null"], maxLength: 4000 },
    hazards: { type: "array", maxItems: 30, items: { type: "string", minLength: 1, maxLength: 300 } },
    supervision: { type: ["string", "null"], maxLength: 4000 },
    emergencyContacts: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        required: ["name", "role", "phone"],
        additionalProperties: false,
        properties: {
          name: { type: "string", maxLength: 120 },
          role: { type: "string", maxLength: 120 },
          phone: { type: "string", maxLength: 40 },
        },
      },
    },
  },
} as const;

type ScopeKind = "proposal" | "project";

const methodStatementRoutes: FastifyPluginAsync = async (fastify) => {
  const service = methodStatementsService(methodStatementsRepository(fastify.db), { draft: chatJsonValidated });
  const proposals = proposalsRepository(fastify.db);

  // Both scopes expose the same verbs; only the guard differs. Proposals reuse
  // the proposals permission for now (see access-control note in the brief).
  async function guard(kind: ScopeKind, request: FastifyRequest, id: string, write: boolean): Promise<SafetyScope> {
    if (kind === "project") {
      const project = await request.requireProjectPermission(id, "risks", write ? "manage" : "view");
      return { projectId: project.id };
    }
    const orgId = request.requireOrgPermission("proposals", write ? "update" : "view");
    const proposal = await proposals.getById(id, orgId);
    if (!proposal) throw new NotFoundError("Proposal");
    return { proposalId: id };
  }

  for (const kind of ["proposal", "project"] as const) {
    const base = kind === "proposal" ? "/proposals/:id" : "/projects/:id";

    fastify.get<{ Params: { id: string } }>(`${base}/method-statements`, { schema: { params: idParams } }, async (request) =>
      service.list(await guard(kind, request, request.params.id, false)),
    );

    fastify.post<{ Params: { id: string }; Body: UpsertMethodStatementInput }>(
      `${base}/method-statements`,
      { schema: { params: idParams, body: statementBody } },
      async (request, reply) => {
        const user = request.requireAuth();
        const scope = await guard(kind, request, request.params.id, true);
        return reply.status(201).send(await service.create(scope, request.body, user.id));
      },
    );

    fastify.put<{ Params: { id: string; statementId: string }; Body: UpsertMethodStatementInput }>(
      `${base}/method-statements/:statementId`,
      { schema: { params: statementParams, body: statementBody } },
      async (request) => {
        const scope = await guard(kind, request, request.params.id, true);
        return service.edit(scope, request.params.statementId, request.body);
      },
    );

    fastify.post<{ Params: { id: string; statementId: string } }>(
      `${base}/method-statements/:statementId/confirm`,
      { schema: { params: statementParams } },
      async (request) => {
        const user = request.requireAuth();
        const scope = await guard(kind, request, request.params.id, true);
        return service.confirm(scope, request.params.statementId, user.id);
      },
    );

    fastify.delete<{ Params: { id: string; statementId: string } }>(
      `${base}/method-statements/:statementId`,
      { schema: { params: statementParams } },
      async (request, reply) => {
        const scope = await guard(kind, request, request.params.id, true);
        await service.remove(scope, request.params.statementId);
        return reply.status(204).send();
      },
    );

    fastify.get<{ Params: { id: string } }>(`${base}/phase-plan`, { schema: { params: idParams } }, async (request) =>
      service.getPhasePlan(await guard(kind, request, request.params.id, false)),
    );

    fastify.put<{ Params: { id: string }; Body: UpsertPhasePlanInput }>(
      `${base}/phase-plan`,
      { schema: { params: idParams, body: phasePlanBody } },
      async (request) => service.upsertPhasePlan(await guard(kind, request, request.params.id, true), request.body),
    );

    fastify.post<{ Params: { id: string } }>(`${base}/phase-plan/confirm`, { schema: { params: idParams } }, async (request) => {
      const user = request.requireAuth();
      return service.confirmPhasePlan(await guard(kind, request, request.params.id, true), user.id);
    });
  }

  // Drafting reads the proposal's brief, structure and programme, so it is a
  // proposal-only verb; a project drafts from its own programme in a later slice.
  fastify.post<{ Params: { id: string } }>(
    "/proposals/:id/method-statements/draft",
    { schema: { params: idParams } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "update");
      const ctx = await buildProposalDraftContext(fastify.db, request.params.id, orgId);
      return reply.status(201).send(await service.draft({ proposalId: request.params.id }, ctx, user.id));
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/proposals/:id/phase-plan/draft",
    { schema: { params: idParams } },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("proposals", "update");
      const ctx = await buildProposalDraftContext(fastify.db, request.params.id, orgId);
      return reply.status(201).send(await service.draftPhasePlan({ proposalId: request.params.id }, ctx));
    },
  );
};

export default methodStatementRoutes;
