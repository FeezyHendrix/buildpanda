import type { FastifyPluginAsync } from "fastify";
import { assertCanActAsClient } from "../../lib/authorization.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { projectsRepository } from "../projects/repository.ts";
import { changeRequestsRepository } from "../change-requests/repository.ts";
import { changeRequestsService } from "../change-requests/service.ts";
import { selectionsRepository } from "./repository.ts";
import {
  selectionsService,
  type CreateSelectionInput,
  type UpdateSelectionInput,
} from "./service.ts";
import { SELECTION_STATUSES, type SelectionStatus } from "./types.ts";

const CURRENCY = ["NGN", "USD"] as const;

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const selectionParams = {
  type: "object",
  required: ["id", "selectionId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    selectionId: { type: "string", minLength: 1 },
  },
} as const;

const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: { status: { type: "string", enum: SELECTION_STATUSES } },
} as const;

const optionItem = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 2000 },
    price: { type: ["number", "null"], minimum: 0 },
  },
} as const;

const createBody = {
  type: "object",
  required: ["title"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 4000 },
    category: { type: ["string", "null"], maxLength: 80 },
    allowanceAmount: { type: ["number", "null"], minimum: 0 },
    currency: { type: "string", enum: CURRENCY },
    dueDate: { type: ["string", "null"], maxLength: 40 },
    options: { type: "array", maxItems: 20, items: optionItem },
  },
} as const;

const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 4000 },
    category: { type: ["string", "null"], maxLength: 80 },
    allowanceAmount: { type: ["number", "null"], minimum: 0 },
    currency: { type: "string", enum: CURRENCY },
    dueDate: { type: ["string", "null"], maxLength: 40 },
    // "decided" is only reachable through the decide endpoint.
    status: { type: "string", enum: ["open", "cancelled"] },
    options: { type: "array", maxItems: 20, items: optionItem },
  },
} as const;

const decideBody = {
  type: "object",
  required: ["optionId"],
  additionalProperties: false,
  properties: { optionId: { type: "string", minLength: 1 } },
} as const;

const optionSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    selectionId: { type: "string" },
    name: { type: "string" },
    description: { type: ["string", "null"] },
    price: { type: ["number", "null"] },
    sortOrder: { type: "integer" },
  },
} as const;

const selectionSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    projectId: { type: "string" },
    title: { type: "string" },
    description: { type: ["string", "null"] },
    category: { type: ["string", "null"] },
    allowanceAmount: { type: ["number", "null"] },
    currency: { type: "string" },
    dueDate: { type: ["string", "null"] },
    status: { type: "string", enum: SELECTION_STATUSES },
    chosenOptionId: { type: ["string", "null"] },
    decidedById: { type: ["string", "null"] },
    decidedByName: { type: ["string", "null"] },
    decidedAt: { type: ["string", "null"] },
    changeRequestId: { type: ["string", "null"] },
    createdById: { type: ["string", "null"] },
    overage: { type: ["number", "null"] },
    options: { type: "array", items: optionSchema },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;

const selectionRoutes: FastifyPluginAsync = async (fastify) => {
  const projects = projectsRepository(fastify.db);
  const notifications = notificationsService(notificationsRepository(fastify.db), fastify.queue);
  const service = selectionsService(selectionsRepository(fastify.db), { notifications });
  const changeRequests = changeRequestsService(changeRequestsRepository(fastify.db), {
    notifications,
  });

  fastify.get<{ Params: { id: string }; Querystring: { status?: SelectionStatus } }>(
    "/projects/:id/selections",
    { schema: { params: projectIdParams, querystring: listQuery, response: { 200: { type: "array", items: selectionSchema } } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "selections", "view");
      return service.list(project.id, request.query.status);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateSelectionInput }>(
    "/projects/:id/selections",
    { schema: { params: projectIdParams, body: createBody, response: { 201: selectionSchema } } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "selections", "manage");
      const user = request.requireAuth();
      const created = await service.create(project.id, request.body, user.id, project.currency);
      return reply.status(201).send(created);
    },
  );

  fastify.get<{ Params: { id: string; selectionId: string } }>(
    "/projects/:id/selections/:selectionId",
    { schema: { params: selectionParams, response: { 200: selectionSchema } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "selections", "view");
      return service.get(project.id, request.params.selectionId);
    },
  );

  fastify.patch<{ Params: { id: string; selectionId: string }; Body: UpdateSelectionInput }>(
    "/projects/:id/selections/:selectionId",
    { schema: { params: selectionParams, body: updateBody, response: { 200: selectionSchema } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "selections", "manage");
      const user = request.requireAuth();
      return service.update(project.id, request.params.selectionId, request.body, user.id);
    },
  );

  fastify.delete<{ Params: { id: string; selectionId: string } }>(
    "/projects/:id/selections/:selectionId",
    { schema: { params: selectionParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "selections", "manage");
      await service.remove(project.id, request.params.selectionId);
      return reply.status(204).send();
    },
  );

  fastify.post<{ Params: { id: string; selectionId: string }; Body: { optionId: string } }>(
    "/projects/:id/selections/:selectionId/decide",
    { schema: { params: selectionParams, body: decideBody, response: { 200: selectionSchema } } },
    async (request) => {
      const user = request.requireAuth();
      const project = await projects.findById(request.params.id);
      if (!project) throw new NotFoundError("Project");
      // The homeowner (client) makes the choice, and company staff can record it
      // on their behalf. assertCanActAsClient blocks viewers and unrelated users
      // — the same gate approvals use for client decisions.
      assertCanActAsClient(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles },
      );
      return service.decide(project.id, request.params.selectionId, request.body.optionId, user.id);
    },
  );

  fastify.post<{ Params: { id: string; selectionId: string } }>(
    "/projects/:id/selections/:selectionId/create-change-request",
    { schema: { params: selectionParams, response: { 200: selectionSchema } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "selections", "manage");
      const user = request.requireAuth();
      return service.createChangeRequest(project.id, request.params.selectionId, user.id, changeRequests);
    },
  );
};

export default selectionRoutes;
