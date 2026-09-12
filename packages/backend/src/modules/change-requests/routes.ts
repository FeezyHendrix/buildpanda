import type { FastifyPluginAsync } from "fastify";
import { contractsRepository } from "../contracts/repository.ts";
import { contractsService } from "../contracts/service.ts";
import { documentsRepository } from "../documents/repository.ts";
import { financesRepository } from "../finances/repository.ts";
import { financesService } from "../finances/service.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { stagesRepository } from "../stages/repository.ts";
import { changeRequestsRepository } from "./repository.ts";
import {
  changeRequestsService,
  type CreateChangeRequestInput,
  type UpdateChangeRequestInput,
} from "./service.ts";
import { CHANGE_STATUSES as STATUS, type ChangeStatus } from "./types.ts";
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
    status: { type: "string", enum: STATUS },
    costImpact: { type: "number" },
    timeImpactDays: { type: "integer" },
    currency: { type: "string", enum: CURRENCY },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
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

const changeRequestRoutes: FastifyPluginAsync = async (fastify) => {
  const financesRepo = financesRepository(fastify.db);
  const finances = financesService(financesRepo);
  const contracts = contractsService(contractsRepository(fastify.db), {
    finances: financesRepo,
    stages: stagesRepository(fastify.db),
    documents: documentsRepository(fastify.db),
  });
  const service = changeRequestsService(changeRequestsRepository(fastify.db), {
    notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue),
    contracts,
    recordVariation: async (projectId, input, actor) => {
      await finances.recordVariation(projectId, { amount: input.amount, description: input.description }, actor);
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
      return service.update(project.id, request.params.changeId, request.body, user.id, user.name);
    },
  );

  fastify.delete<{ Params: { id: string; changeId: string } }>(
    "/projects/:id/change-requests/:changeId",
    { schema: { params: crParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "change-requests", "manage");
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
