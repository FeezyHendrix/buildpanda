import type { FastifyPluginAsync } from "fastify";
import { actionItemsRepository } from "./repository.ts";
import {
  actionItemsService,
  type CreateActionItemInput,
  type UpdateActionItemInput,
} from "./service.ts";
import type { ActionStatus } from "./types.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";

const STATUS = ["Open", "InProgress", "Blocked", "Resolved"] as const;
const PRIORITY = ["Low", "Medium", "High", "Urgent"] as const;

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const itemParams = {
  type: "object",
  required: ["id", "itemId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    itemId: { type: "string", minLength: 1 },
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
    description: { type: ["string", "null"], maxLength: 2000 },
    status: { type: "string", enum: STATUS },
    priority: { type: "string", enum: PRIORITY },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
    dueDate: { type: ["string", "null"], maxLength: 40 },
    recurrenceUnit: { type: ["string", "null"], enum: ["day", "week", "month", null] },
    recurrenceInterval: { type: ["integer", "null"], minimum: 1, maximum: 365 },
    recurrenceUntil: { type: ["string", "null"], maxLength: 40 },
  },
} as const;

const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 2000 },
    status: { type: "string", enum: STATUS },
    priority: { type: "string", enum: PRIORITY },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
    dueDate: { type: ["string", "null"], maxLength: 40 },
    recurrenceUnit: { type: ["string", "null"], enum: ["day", "week", "month", null] },
    recurrenceInterval: { type: ["integer", "null"], minimum: 1, maximum: 365 },
    recurrenceUntil: { type: ["string", "null"], maxLength: 40 },
  },
} as const;

const commentBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: { body: { type: "string", minLength: 1, maxLength: 2000 } },
} as const;

const actionItemRoutes: FastifyPluginAsync = async (fastify) => {
  const service = actionItemsService(actionItemsRepository(fastify.db), {
    notifications: notificationsService(notificationsRepository(fastify.db)),
  });

  fastify.get<{ Params: { id: string }; Querystring: { status?: ActionStatus } }>(
    "/projects/:id/action-items",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.list(project.id, request.query.status);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateActionItemInput }>(
    "/projects/:id/action-items",
    { schema: { params: projectIdParams, body: createBody } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      const item = await service.create(project.id, request.body, user.id);
      return reply.status(201).send(item);
    },
  );

  fastify.get<{ Params: { id: string; itemId: string } }>(
    "/projects/:id/action-items/:itemId",
    { schema: { params: itemParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.get(project.id, request.params.itemId);
    },
  );

  fastify.patch<{ Params: { id: string; itemId: string }; Body: UpdateActionItemInput }>(
    "/projects/:id/action-items/:itemId",
    { schema: { params: itemParams, body: updateBody } },
    async (request) => {
      const project = await request.requireProjectWrite(request.params.id);
      return service.update(project.id, request.params.itemId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; itemId: string } }>(
    "/projects/:id/action-items/:itemId",
    { schema: { params: itemParams } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      await service.remove(project.id, request.params.itemId);
      return reply.status(204).send();
    },
  );

  fastify.post<{ Params: { id: string; itemId: string }; Body: { body: string } }>(
    "/projects/:id/action-items/:itemId/comments",
    { schema: { params: itemParams, body: commentBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "comments", "post");
      const user = request.requireAuth();
      const comment = await service.addComment(project.id, request.params.itemId, request.body.body, {
        id: user.id,
        name: user.name,
      });
      return reply.status(201).send(comment);
    },
  );
};

export default actionItemRoutes;
