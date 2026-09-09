import type { FastifyPluginAsync } from "fastify";
import { idParams as projectIdParams } from "../../lib/schemas.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { queriesRepository } from "./repository.ts";
import {
  queriesService,
  type CreateQueryInput,
  type UpdateQueryInput,
} from "./service.ts";
import type { QueryStatus } from "./types.ts";

const STATUS = ["Open", "Answered", "Closed"] as const;

const queryParams = {
  type: "object",
  required: ["id", "queryId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    queryId: { type: "string", minLength: 1 },
  },
} as const;

const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: { status: { type: "string", enum: STATUS } },
} as const;

const createBody = {
  type: "object",
  required: ["subject", "question"],
  additionalProperties: false,
  properties: {
    subject: { type: "string", minLength: 1, maxLength: 200 },
    question: { type: "string", minLength: 1, maxLength: 4000 },
    questionHtml: { type: ["string", "null"], maxLength: 200000 },
    dueDate: { type: ["string", "null"], maxLength: 40 },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
  },
} as const;

const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    subject: { type: "string", minLength: 1, maxLength: 200 },
    question: { type: "string", minLength: 1, maxLength: 4000 },
    questionHtml: { type: ["string", "null"], maxLength: 200000 },
    status: { type: "string", enum: STATUS },
    answer: { type: ["string", "null"], maxLength: 4000 },
    answerHtml: { type: ["string", "null"], maxLength: 200000 },
    dueDate: { type: ["string", "null"], maxLength: 40 },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
  },
} as const;

const commentBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: { body: { type: "string", minLength: 1, maxLength: 2000 } },
} as const;

const queryRoutes: FastifyPluginAsync = async (fastify) => {
  const service = queriesService(queriesRepository(fastify.db), {
    notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue),
  });

  fastify.get<{ Params: { id: string }; Querystring: { status?: QueryStatus } }>(
    "/projects/:id/queries",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "queries", "view");
      return service.list(project.id, request.query.status);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateQueryInput }>(
    "/projects/:id/queries",
    { schema: { params: projectIdParams, body: createBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      // Homeowner (client), company staff, or any participant granted
      // queries:raise via role default or section matrix.
      const project = await request.requireProjectPermission(
        request.params.id,
        "queries",
        "raise",
      );
      const created = await service.create(project.id, request.body, user.id);
      return reply.status(201).send(created);
    },
  );

  fastify.get<{ Params: { id: string; queryId: string } }>(
    "/projects/:id/queries/:queryId",
    { schema: { params: queryParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "queries", "view");
      return service.get(project.id, request.params.queryId);
    },
  );

  fastify.patch<{ Params: { id: string; queryId: string }; Body: UpdateQueryInput }>(
    "/projects/:id/queries/:queryId",
    { schema: { params: queryParams, body: updateBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "queries", "raise");
      const user = request.requireAuth();
      return service.update(project.id, request.params.queryId, request.body, user.id);
    },
  );

  fastify.delete<{ Params: { id: string; queryId: string } }>(
    "/projects/:id/queries/:queryId",
    { schema: { params: queryParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "queries", "manage");
      await service.remove(project.id, request.params.queryId);
      return reply.status(204).send();
    },
  );

  fastify.post<{ Params: { id: string; queryId: string }; Body: { body: string } }>(
    "/projects/:id/queries/:queryId/comments",
    { schema: { params: queryParams, body: commentBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "comments", "post");
      const user = request.requireAuth();
      const comment = await service.addComment(project.id, request.params.queryId, request.body.body, {
        id: user.id,
        name: user.name,
      });
      return reply.status(201).send(comment);
    },
  );
};

export default queryRoutes;
