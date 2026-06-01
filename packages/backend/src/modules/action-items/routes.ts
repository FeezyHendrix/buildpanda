import type { FastifyPluginAsync } from "fastify";
import { assertCanAccessProject, assertCanModifyProject } from "../../lib/authorization.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { projectsRepository } from "../projects/repository.ts";
import { actionItemsRepository } from "./repository.ts";
import {
  actionItemsService,
  type CreateActionItemInput,
  type UpdateActionItemInput,
} from "./service.ts";
import type { ActionStatus } from "./types.ts";

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
  },
} as const;

const commentBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: { body: { type: "string", minLength: 1, maxLength: 2000 } },
} as const;

const actionItemRoutes: FastifyPluginAsync = async (fastify) => {
  const projects = projectsRepository(fastify.db);
  const service = actionItemsService(actionItemsRepository(fastify.db));

  async function loadProject(id: string) {
    const project = await projects.findById(id);
    if (!project) throw new NotFoundError("Project");
    return project;
  }

  fastify.get<{ Params: { id: string }; Querystring: { status?: ActionStatus } }>(
    "/projects/:id/action-items",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const user = request.requireAuth();
      const project = await loadProject(request.params.id);
      assertCanAccessProject(
        { ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles },
      );
      return service.list(project.id, request.query.status);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateActionItemInput }>(
    "/projects/:id/action-items",
    { schema: { params: projectIdParams, body: createBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const project = await loadProject(request.params.id);
      assertCanModifyProject(
        { ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles },
      );
      const item = await service.create(project.id, request.body, user.id);
      return reply.status(201).send(item);
    },
  );

  fastify.get<{ Params: { id: string; itemId: string } }>(
    "/projects/:id/action-items/:itemId",
    { schema: { params: itemParams } },
    async (request) => {
      const user = request.requireAuth();
      const project = await loadProject(request.params.id);
      assertCanAccessProject(
        { ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles },
      );
      return service.get(project.id, request.params.itemId);
    },
  );

  fastify.patch<{ Params: { id: string; itemId: string }; Body: UpdateActionItemInput }>(
    "/projects/:id/action-items/:itemId",
    { schema: { params: itemParams, body: updateBody } },
    async (request) => {
      const user = request.requireAuth();
      const project = await loadProject(request.params.id);
      assertCanModifyProject(
        { ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles },
      );
      return service.update(project.id, request.params.itemId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; itemId: string } }>(
    "/projects/:id/action-items/:itemId",
    { schema: { params: itemParams } },
    async (request, reply) => {
      const user = request.requireAuth();
      const project = await loadProject(request.params.id);
      assertCanModifyProject(
        { ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles },
      );
      await service.remove(project.id, request.params.itemId);
      return reply.status(204).send();
    },
  );

  fastify.post<{ Params: { id: string; itemId: string }; Body: { body: string } }>(
    "/projects/:id/action-items/:itemId/comments",
    { schema: { params: itemParams, body: commentBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const project = await loadProject(request.params.id);
      assertCanAccessProject(
        { ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles },
      );
      const comment = await service.addComment(project.id, request.params.itemId, request.body.body, {
        id: user.id,
        name: user.name,
      });
      return reply.status(201).send(comment);
    },
  );
};

export default actionItemRoutes;
