import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { canProjectPermission } from "../../lib/authorization.ts";
import { contractsRepository } from "../contracts/repository.ts";
import { contractsService } from "../contracts/service.ts";
import { documentsRepository } from "../documents/repository.ts";
import { financesRepository } from "../finances/repository.ts";
import { financesService } from "../finances/service.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { stagesRepository } from "../stages/repository.ts";
import { stagesService } from "../stages/service.ts";
import { changeActions } from "./change-actions.ts";
import { applyApprovedEot } from "../extensions-of-time/service.ts";
import { changeRequestsRepository } from "./repository.ts";
import { changeRequestsService } from "./service.ts";
import {
  CHANGE_ACTIONS,
  CHANGE_STATUSES as STATUS,
  CHANGE_TYPES,
  type ChangeAction,
  type ChangeActionInput,
  type ChangeStatus,
  type CreateChangeRequestInput,
  type UpdateChangeRequestInput,
} from "./types.ts";
const CURRENCY = ["NGN", "USD"] as const;

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const crParams = {
  type: "object",
  required: ["id", "changeId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    changeId: { type: "string", minLength: 1 },
  },
} as const;

const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: { status: { type: "string", enum: STATUS } },
} as const;

const createBody = {
  type: "object",
  required: ["title"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 4000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    reason: { type: ["string", "null"], maxLength: 1000 },
    reasonHtml: { type: ["string", "null"], maxLength: 200000 },
    costImpact: { type: "number" },
    timeImpactDays: { type: "integer" },
    currency: { type: "string", enum: CURRENCY },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
    type: { type: "string", enum: CHANGE_TYPES },
    stageId: { type: ["string", "null"], maxLength: 100 },
    rfiId: { type: ["string", "null"], maxLength: 100 },
    eotClaimId: { type: ["string", "null"], maxLength: 100 },
  },
} as const;

const budgetLinksBody = {
  type: "object",
  required: ["links"],
  additionalProperties: false,
  properties: {
    links: {
      type: "array",
      items: {
        type: "object",
        required: ["budgetCategoryId", "amount"],
        additionalProperties: false,
        properties: {
          budgetCategoryId: { type: "string", minLength: 1 },
          amount: { type: "number", minimum: 0 },
          committed: { type: "boolean" },
        },
      },
    },
  },
} as const;

const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 4000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    reason: { type: ["string", "null"], maxLength: 1000 },
    reasonHtml: { type: ["string", "null"], maxLength: 200000 },
    costImpact: { type: "number" },
    timeImpactDays: { type: "integer" },
    currency: { type: "string", enum: CURRENCY },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
    type: { type: "string", enum: CHANGE_TYPES },
    stageId: { type: ["string", "null"], maxLength: 100 },
    rfiId: { type: ["string", "null"], maxLength: 100 },
    eotClaimId: { type: ["string", "null"], maxLength: 100 },
  },
} as const;

const actionParams = {
  type: "object",
  required: ["id", "changeId", "action"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    changeId: { type: "string", minLength: 1 },
    action: { type: "string", enum: CHANGE_ACTIONS },
  },
} as const;

const actionBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    /** Required on reject; carried into the revision history on resubmit. */
    reason: { type: "string", minLength: 1, maxLength: 2000 },
    costImpact: { type: "number" },
    timeImpactDays: { type: "integer" },
  },
} as const;

const commentBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: { body: { type: "string", minLength: 1, maxLength: 2000 } },
} as const;

const summaryResponse = {
  200: {
    type: "object",
    properties: {
      draft: { type: "integer" },
      submitted: { type: "integer" },
      approved: { type: "integer" },
      executed: { type: "integer" },
      rejected: { type: "integer" },
      grossProfit: { type: ["number", "null"] },
    },
  },
} as const;

/**
 * Does this caller hold the separate approval grant? Being able to raise and
 * price a change is not the same as being able to decide one.
 */
function holdsApproval(
  request: FastifyRequest,
  project: { id: string; owner_id: string | null; organization_id: string | null },
): boolean {
  return canProjectPermission(
    { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
    {
      userId: request.user!.id,
      orgRoles: request.orgRoles,
      orgPermissions: request.orgPermissions,
      projectRoles: request.projectRoles,
      projectSectionPermissions: request.projectSectionPermissions,
      projectGrants: request.projectGrants,
    },
    "change-requests",
    "approve",
  );
}

const changeRequestRoutes: FastifyPluginAsync = async (fastify) => {
  const financesRepo = financesRepository(fastify.db);
  const finances = financesService(financesRepo);
  const contracts = contractsService(contractsRepository(fastify.db), {
    finances: financesRepo,
    stages: stagesRepository(fastify.db),
    documents: documentsRepository(fastify.db),
  });
  const repository = changeRequestsRepository(fastify.db);
  const stages = stagesService(stagesRepository(fastify.db), async () => undefined);
  const service = changeRequestsService(repository, {
    notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue),
    contracts,
    recordVariation: async (projectId, input, actor) => {
      await finances.recordVariation(projectId, { amount: input.amount, description: input.description }, actor);
    },
  });

  /**
   * Executing an approved change actually moves the programme: the stage it was
   * claimed against shifts by the agreed days, and a time claim awards those
   * days through the extensions-of-time module, which owns the revised
   * completion date and the contractual key dates that follow it.
   */
  const actions = changeActions(repository, {
    assertExecutable: (row) => service.assertExecutable(row),
    shiftStageEnd: async (projectId, stageId, days) => {
      const stage = (await stages.list(projectId)).find((s) => s.id === stageId);
      if (!stage?.endDate) return;
      const moved = new Date(`${stage.endDate}T00:00:00Z`);
      moved.setUTCDate(moved.getUTCDate() + days);
      await stages.update(projectId, stageId, { endDate: moved.toISOString().slice(0, 10) });
    },
    applyApprovedEot: async (projectId, days) => {
      await applyApprovedEot(projectId, days, fastify.db);
    },
    onApproved: (row, actor) => service.onApproved(row, { id: actor.id, name: actor.name }),
    onDecided: (row, action, reason, actor) => {
      if (action === "reject") service.notifyDecided(row, "Rejected", actor.id, reason);
      else if (action === "approve") service.notifyDecided(row, "Approved", actor.id);
      else if (action === "submit" || action === "resubmit") {
        service.notifyDecided(row, "Submitted", actor.id);
      }
    },
  });

  // Declared before the :changeId routes so "summary" is never read as an id.
  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/change-requests/summary",
    { schema: { params: projectIdParams, response: summaryResponse } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "change-requests", "view");
      return service.summary(project.id);
    },
  );

  fastify.get<{ Params: { id: string }; Querystring: { status?: ChangeStatus } }>(
    "/projects/:id/change-requests",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "change-requests", "view");
      return service.list(project.id, request.query.status);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateChangeRequestInput }>(
    "/projects/:id/change-requests",
    { schema: { params: projectIdParams, body: createBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "change-requests", "manage");
      const user = request.requireAuth();
      const created = await service.create(project.id, request.body, user.id);
      return reply.status(201).send(created);
    },
  );

  fastify.get<{ Params: { id: string; changeId: string } }>(
    "/projects/:id/change-requests/:changeId",
    { schema: { params: crParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "change-requests", "view");
      return service.get(project.id, request.params.changeId);
    },
  );

  fastify.patch<{ Params: { id: string; changeId: string }; Body: UpdateChangeRequestInput }>(
    "/projects/:id/change-requests/:changeId",
    { schema: { params: crParams, body: updateBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "change-requests", "manage");
      const user = request.requireAuth();
      return service.update(project.id, request.params.changeId, request.body, user.id);
    },
  );

  /**
   * The only way the ladder is walked. Each action is a decision with an actor,
   * a timestamp and — for a rejection — a reason, so the register reads as the
   * negotiation it records rather than as a status someone typed.
   */
  fastify.post<{
    Params: { id: string; changeId: string; action: ChangeAction };
    Body: ChangeActionInput;
  }>(
    "/projects/:id/change-requests/:changeId/:action",
    { schema: { params: actionParams, body: actionBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "change-requests", "manage");
      const user = request.requireAuth();
      await actions.run(project.id, request.params.changeId, request.params.action, request.body, {
        id: user.id,
        name: user.name,
        // Everyone reaching this route holds change-requests:manage, which IS
        // the approval grant; the self-decision guard only bites when a future
        // preset separates proposing from deciding.
        holdsApproval: holdsApproval(request, project),
      });
      return service.get(project.id, request.params.changeId);
    },
  );

  fastify.delete<{ Params: { id: string; changeId: string } }>(
    "/projects/:id/change-requests/:changeId",
    { schema: { params: crParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "change-requests", "manage");
      await actions.assertRemovable(
        project.id,
        request.params.changeId,
        await repository.countReferencingRfis(request.params.changeId),
      );
      await service.remove(project.id, request.params.changeId);
      return reply.status(204).send();
    },
  );

  fastify.post<{ Params: { id: string; changeId: string }; Body: { body: string } }>(
    "/projects/:id/change-requests/:changeId/comments",
    { schema: { params: crParams, body: commentBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "comments", "post");
      const user = request.requireAuth();
      const comment = await service.addComment(project.id, request.params.changeId, request.body.body, {
        id: user.id,
        name: user.name,
      });
      return reply.status(201).send(comment);
    },
  );

  fastify.get<{ Params: { id: string; changeId: string } }>(
    "/projects/:id/change-requests/:changeId/budget-links",
    { schema: { params: crParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "change-requests", "view");
      return service.getBudgetLinks(project.id, request.params.changeId);
    },
  );

  fastify.put<{
    Params: { id: string; changeId: string };
    Body: { links: { budgetCategoryId: string; amount: number; committed?: boolean }[] };
  }>(
    "/projects/:id/change-requests/:changeId/budget-links",
    { schema: { params: crParams, body: budgetLinksBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "change-requests", "manage");
      return service.setBudgetLinks(
        project.id,
        request.params.changeId,
        request.body.links.map((l) => ({
          budgetCategoryId: l.budgetCategoryId,
          amount: l.amount,
          committed: l.committed ?? false,
        })),
      );
    },
  );
};

export default changeRequestRoutes;
