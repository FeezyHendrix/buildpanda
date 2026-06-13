import type { FastifyPluginAsync } from "fastify";
import { changeRequestsRepository } from "./repository.ts";
import {
  changeRequestsService,
  type CreateChangeRequestInput,
  type UpdateChangeRequestInput,
} from "./service.ts";
import type { ChangeStatus } from "./types.ts";

const STATUS = ["Draft", "Submitted", "Approved", "Rejected"] as const;
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
    reason: { type: ["string", "null"], maxLength: 1000 },
    costImpact: { type: "number" },
    timeImpactDays: { type: "integer" },
    currency: { type: "string", enum: CURRENCY },
  },
} as const;

const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 4000 },
    reason: { type: ["string", "null"], maxLength: 1000 },
    status: { type: "string", enum: STATUS },
    costImpact: { type: "number" },
    timeImpactDays: { type: "integer" },
    currency: { type: "string", enum: CURRENCY },
  },
} as const;

const commentBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: { body: { type: "string", minLength: 1, maxLength: 2000 } },
} as const;

const changeRequestRoutes: FastifyPluginAsync = async (fastify) => {
  const service = changeRequestsService(changeRequestsRepository(fastify.db));

  fastify.get<{ Params: { id: string }; Querystring: { status?: ChangeStatus } }>(
    "/projects/:id/change-requests",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.list(project.id, request.query.status);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateChangeRequestInput }>(
    "/projects/:id/change-requests",
    { schema: { params: projectIdParams, body: createBody } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      const created = await service.create(project.id, request.body, user.id);
      return reply.status(201).send(created);
    },
  );

  fastify.get<{ Params: { id: string; changeId: string } }>(
    "/projects/:id/change-requests/:changeId",
    { schema: { params: crParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.get(project.id, request.params.changeId);
    },
  );

  fastify.patch<{ Params: { id: string; changeId: string }; Body: UpdateChangeRequestInput }>(
    "/projects/:id/change-requests/:changeId",
    { schema: { params: crParams, body: updateBody } },
    async (request) => {
      const project = await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      return service.update(project.id, request.params.changeId, request.body, user.id);
    },
  );

  fastify.delete<{ Params: { id: string; changeId: string } }>(
    "/projects/:id/change-requests/:changeId",
    { schema: { params: crParams } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
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
};

export default changeRequestRoutes;
