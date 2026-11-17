import { registerUpdateComments } from "./comment-routes.ts";
import { filesService } from "../files/service.ts";
import { filesRepository } from "../files/repository.ts";
import type { FastifyPluginAsync } from "fastify";
import { canProjectPermission } from "../../lib/authorization.ts";
import { requestAccessContext } from "../../lib/authorization-request.ts";
import { aiDraftService } from "./ai-draft.ts";
import { dailyDigestService, isoDate } from "./daily-digest.ts";
import { updatesRepository } from "./repository.ts";
import type { UpdateListFilters } from "./types.ts";
import {
  updatesService,
  type CreateUpdateInput,
  type EditUpdateInput,
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

import { createUpdateBody, editUpdateBody } from "./route-schemas.ts";

const dailyDigestQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
  },
} as const;

const updateRoutes: FastifyPluginAsync = async (fastify) => {
  const service = updatesService(updatesRepository(fastify.db), filesService(filesRepository(fastify.db)));
  const aiDraft = aiDraftService(fastify.db);
  const dailyDigest = dailyDigestService(fastify.db);

  fastify.get<{ Params: { id: string }; Querystring: UpdateListFilters }>(
    "/projects/:id/updates",
    { schema: {
      params: projectIdParams,
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: { stageId: { type: "string", minLength: 1, maxLength: 200 } },
      },
    } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "updates", "view");
      const includeDrafts = canProjectPermission(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        requestAccessContext(request), "updates", "post",
      );
      return service.listByProject(project.id, { includeDrafts, stageId: request.query.stageId });
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/projects/:id/updates/ai-draft",
    { schema: { params: projectIdParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "updates", "post");
      const user = request.requireAuth();
      const result = await aiDraft.generateClientUpdateDraft({
        projectId: project.id,
        requestedBy: { id: user.id, name: user.name },
      });
      return reply.status(result.created ? 201 : 200).send(result.update);
    },
  );

  fastify.post<{ Params: { id: string }; Querystring: { date?: string } }>(
    "/projects/:id/updates/daily-digest",
    { schema: { params: projectIdParams, querystring: dailyDigestQuery } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "updates", "post");
      const user = request.requireAuth();
      const outcome = await dailyDigest.generateDailyDigest({
        projectId: project.id,
        digestDate: request.query.date ?? isoDate(new Date()),
        requestedBy: { id: user.id, name: user.name },
      });
      return reply.status(outcome.status === "created" ? 201 : 200).send(outcome.update);
    },
  );

  fastify.post<{ Params: { id: string; updateId: string } }>(
    "/projects/:id/updates/:updateId/publish",
    { schema: { params: updateIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "updates", "post");
      return service.publish(project.id, request.params.updateId);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateUpdateInput }>(
    "/projects/:id/updates",
    { schema: { params: projectIdParams, body: createUpdateBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "updates", "post");
      const user = request.requireAuth();
      const update = await service.create(project.id, request.body, {
        id: user.id,
        name: user.name,
      });
      return reply.status(201).send(update);
    },
  );

  fastify.put<{
    Params: { id: string; updateId: string };
    Body: EditUpdateInput;
  }>(
    "/projects/:id/updates/:updateId",
    { schema: { params: updateIdParams, body: editUpdateBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "updates", "post");
      return service.edit(project.id, request.params.updateId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; updateId: string } }>(
    "/projects/:id/updates/:updateId",
    { schema: { params: updateIdParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "updates", "post");
      await service.remove(project.id, request.params.updateId);
      return reply.status(204).send();
    },
  );

  fastify.patch<{
    Params: { id: string; updateId: string };
    Body: TransitionUpdateInput;
  }>(
    "/projects/:id/updates/:updateId",
    { schema: { params: updateIdParams, body: transitionBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "updates", "post");
      const user = request.requireAuth();
      return service.transition(
        project.id,
        request.params.updateId,
        request.body,
        { id: user.id, name: user.name },
      );
    },
  );

  await registerUpdateComments(fastify, service);
};

export default updateRoutes;
