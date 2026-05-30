import type { FastifyPluginAsync } from "fastify";
import { assertCanModify } from "../../lib/authorization.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { projectsRepository } from "../projects/repository.ts";
import { updatesRepository } from "./repository.ts";
import {
  updatesService,
  type AddCommentInput,
  type TransitionUpdateInput,
} from "./service.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const updateIdParams = {
  type: "object",
  required: ["id", "updateId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    updateId: { type: "string", minLength: 1 },
  },
} as const;

const transitionBody = {
  type: "object",
  required: ["status"],
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: ["Approved", "Inspected", "Resolved", "Escalated"],
    },
  },
} as const;

const commentBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: {
    body: { type: "string", minLength: 1, maxLength: 2000 },
  },
} as const;

const updateRoutes: FastifyPluginAsync = async (fastify) => {
  const projects = projectsRepository(fastify.db);
  const service = updatesService(updatesRepository(fastify.db));

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/updates",
    { schema: { params: projectIdParams } },
    async (request) => {
      request.requireAuth();
      return service.listByProject(request.params.id);
    },
  );

  fastify.patch<{
    Params: { id: string; updateId: string };
    Body: TransitionUpdateInput;
  }>(
    "/projects/:id/updates/:updateId",
    { schema: { params: updateIdParams, body: transitionBody } },
    async (request) => {
      const user = request.requireAuth();
      const project = await projects.findById(request.params.id);
      if (!project) throw new NotFoundError("Project");
      assertCanModify({ ownerId: project.owner_id }, user);

      return service.transition(
        project.id,
        request.params.updateId,
        request.body,
        { id: user.id, name: user.name },
      );
    },
  );

  fastify.get<{ Params: { id: string; updateId: string } }>(
    "/projects/:id/updates/:updateId/comments",
    { schema: { params: updateIdParams } },
    async (request) => {
      request.requireAuth();
      return service.listComments(request.params.id, request.params.updateId);
    },
  );

  fastify.post<{
    Params: { id: string; updateId: string };
    Body: AddCommentInput;
  }>(
    "/projects/:id/updates/:updateId/comments",
    { schema: { params: updateIdParams, body: commentBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const project = await projects.findById(request.params.id);
      if (!project) throw new NotFoundError("Project");
      assertCanModify({ ownerId: project.owner_id }, user);

      const comment = await service.addComment(
        project.id,
        request.params.updateId,
        request.body,
        { id: user.id, name: user.name },
      );
      return reply.status(201).send(comment);
    },
  );
};

export default updateRoutes;
