import type { FastifyPluginAsync } from "fastify";
import { assertCanActAsClient } from "../../lib/authorization.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { projectsRepository } from "../projects/repository.ts";
import { approvalsRepository } from "./repository.ts";
import {
  approvalsService,
  type CreateApprovalInput,
  type UpdateApprovalInput,
} from "./service.ts";
import type { ApprovalStatus } from "./types.ts";

const STATUS = ["Pending", "Approved", "Rejected", "Resubmit"] as const;

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const approvalParams = {
  type: "object",
  required: ["id", "approvalId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    approvalId: { type: "string", minLength: 1 },
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
    category: { type: ["string", "null"], maxLength: 80 },
    description: { type: ["string", "null"], maxLength: 4000 },
    dueDate: { type: ["string", "null"], maxLength: 40 },
  },
} as const;

const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    category: { type: ["string", "null"], maxLength: 80 },
    description: { type: ["string", "null"], maxLength: 4000 },
    status: { type: "string", enum: STATUS },
    response: { type: ["string", "null"], maxLength: 4000 },
    dueDate: { type: ["string", "null"], maxLength: 40 },
  },
} as const;

const commentBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: { body: { type: "string", minLength: 1, maxLength: 2000 } },
} as const;

const approvalRoutes: FastifyPluginAsync = async (fastify) => {
  const projects = projectsRepository(fastify.db);
  const service = approvalsService(approvalsRepository(fastify.db), {
    notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue),
  });

  async function loadProject(id: string) {
    const project = await projects.findById(id);
    if (!project) throw new NotFoundError("Project");
    return project;
  }

  fastify.get<{ Params: { id: string }; Querystring: { status?: ApprovalStatus } }>(
    "/projects/:id/approvals",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.list(project.id, request.query.status);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateApprovalInput }>(
    "/projects/:id/approvals",
    { schema: { params: projectIdParams, body: createBody } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      const created = await service.create(project.id, request.body, user.id);
      return reply.status(201).send(created);
    },
  );

  fastify.get<{ Params: { id: string; approvalId: string } }>(
    "/projects/:id/approvals/:approvalId",
    { schema: { params: approvalParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.get(project.id, request.params.approvalId);
    },
  );

  fastify.patch<{ Params: { id: string; approvalId: string }; Body: UpdateApprovalInput }>(
    "/projects/:id/approvals/:approvalId",
    { schema: { params: approvalParams, body: updateBody } },
    async (request) => {
      const user = request.requireAuth();
      const project = await loadProject(request.params.id);
      // The homeowner (client) signs off approvals, as well as company staff.
      assertCanActAsClient(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles },
      );
      return service.update(project.id, request.params.approvalId, request.body, user.id);
    },
  );

  fastify.delete<{ Params: { id: string; approvalId: string } }>(
    "/projects/:id/approvals/:approvalId",
    { schema: { params: approvalParams } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      await service.remove(project.id, request.params.approvalId);
      return reply.status(204).send();
    },
  );

  fastify.post<{ Params: { id: string; approvalId: string }; Body: { body: string } }>(
    "/projects/:id/approvals/:approvalId/comments",
    { schema: { params: approvalParams, body: commentBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "comments", "post");
      const user = request.requireAuth();
      const comment = await service.addComment(project.id, request.params.approvalId, request.body.body, {
        id: user.id,
        name: user.name,
      });
      return reply.status(201).send(comment);
    },
  );
};

export default approvalRoutes;
