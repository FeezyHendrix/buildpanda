import type { FastifyPluginAsync } from "fastify";
import { assertCanModifyProject } from "../../lib/authorization.ts";
import { aiDraftService } from "./ai-draft.ts";
import { updatesRepository } from "./repository.ts";
import {
  updatesService,
  type AddCommentInput,
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

const commentBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: {
    body: { type: "string", minLength: 1, maxLength: 2000 },
  },
} as const;

const updateCategoryEnum = [
  "Progress",
  "Material Delivery",
  "Inspections",
  "Issues",
] as const;

const mediaItems = {
  type: "array",
  maxItems: 10,
  items: {
    type: "object",
    required: ["type", "url"],
    additionalProperties: false,
    properties: {
      type: { type: "string", enum: ["photo", "video"] },
      url: { type: "string", minLength: 1, maxLength: 2000 },
    },
  },
} as const;

const createUpdateBody = {
  type: "object",
  required: ["category", "title", "description"],
  additionalProperties: false,
  properties: {
    category: { type: "string", enum: [...updateCategoryEnum] },
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", minLength: 1, maxLength: 2000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    media: mediaItems,
  },
} as const;

const editUpdateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    category: { type: "string", enum: [...updateCategoryEnum] },
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", minLength: 1, maxLength: 2000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    media: mediaItems,
  },
} as const;

const updateRoutes: FastifyPluginAsync = async (fastify) => {
  const service = updatesService(updatesRepository(fastify.db));
  const aiDraft = aiDraftService(fastify.db);

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/updates",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      const user = request.requireAuth();
      // Drafts are visible only to callers who could publish them (project
      // owner / non-viewer org members) — homeowner participants see only
      // published updates.
      let includeDrafts = true;
      try {
        assertCanModifyProject(
          { ownerId: project.owner_id, organizationId: project.organization_id },
          { userId: user.id, orgRoles: request.orgRoles },
        );
      } catch {
        includeDrafts = false;
      }
      return service.listByProject(project.id, { includeDrafts });
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/projects/:id/updates/ai-draft",
    { schema: { params: projectIdParams } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      const result = await aiDraft.generateClientUpdateDraft({
        projectId: project.id,
        requestedBy: { id: user.id, name: user.name },
      });
      return reply.status(result.created ? 201 : 200).send(result.update);
    },
  );

  fastify.post<{ Params: { id: string; updateId: string } }>(
    "/projects/:id/updates/:updateId/publish",
    { schema: { params: updateIdParams } },
    async (request) => {
      const project = await request.requireProjectWrite(request.params.id);
      return service.publish(project.id, request.params.updateId);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateUpdateInput }>(
    "/projects/:id/updates",
    { schema: { params: projectIdParams, body: createUpdateBody } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
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
      const project = await request.requireProjectWrite(request.params.id);
      return service.edit(project.id, request.params.updateId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; updateId: string } }>(
    "/projects/:id/updates/:updateId",
    { schema: { params: updateIdParams } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
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
      const project = await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
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
      const project = await request.requireProjectAccess(request.params.id);
      return service.listComments(project.id, request.params.updateId);
    },
  );

  fastify.post<{
    Params: { id: string; updateId: string };
    Body: AddCommentInput;
  }>(
    "/projects/:id/updates/:updateId/comments",
    { schema: { params: updateIdParams, body: commentBody } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
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
