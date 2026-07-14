import type { FastifyPluginAsync } from "fastify";
import { ForbiddenError } from "../../lib/errors.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
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
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    dueDate: { type: ["string", "null"], maxLength: 40 },
    requestedReviewerId: { type: ["string", "null"], maxLength: 100 },
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
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    status: { type: "string", enum: STATUS },
    response: { type: ["string", "null"], maxLength: 4000 },
    dueDate: { type: ["string", "null"], maxLength: 40 },
    requestedReviewerId: { type: ["string", "null"], maxLength: 100 },
  },
} as const;

const commentBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: { body: { type: "string", minLength: 1, maxLength: 2000 } },
} as const;

const approvalRoutes: FastifyPluginAsync = async (fastify) => {
  const service = approvalsService(approvalsRepository(fastify.db), {
    notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue),
  });

  fastify.get<{ Params: { id: string }; Querystring: { status?: ApprovalStatus } }>(
    "/projects/:id/approvals",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "approvals", "view");
      return service.list(project.id, request.query.status);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateApprovalInput }>(
    "/projects/:id/approvals",
    { schema: { params: projectIdParams, body: createBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "approvals", "manage");
      const user = request.requireAuth();
      const created = await service.create(project.id, request.body, user.id);
      return reply.status(201).send(created);
    },
  );

  fastify.get<{ Params: { id: string; approvalId: string } }>(
    "/projects/:id/approvals/:approvalId",
    { schema: { params: approvalParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "approvals", "view");
      return service.get(project.id, request.params.approvalId);
    },
  );

  fastify.patch<{ Params: { id: string; approvalId: string }; Body: UpdateApprovalInput }>(
    "/projects/:id/approvals/:approvalId",
    { schema: { params: approvalParams, body: updateBody } },
    async (request) => {
      const user = request.requireAuth();
      // Homeowner (client), company staff, or any participant granted
      // approvals:decide via role default or section matrix.
      const project = await request.requireProjectPermission(
        request.params.id,
        "approvals",
        "decide",
      );
      // If the approval was directed at a specific reviewer, only that person may
      // record the decision (status change). Editing other fields stays open to
      // the baseline set above.
      const decidingStatus =
        request.body.status !== undefined &&
        ["Approved", "Rejected", "Resubmit"].includes(request.body.status);
      if (decidingStatus) {
        const approval = await service.get(project.id, request.params.approvalId);
        if (approval.requestedReviewerId && approval.requestedReviewerId !== user.id) {
          throw new ForbiddenError("This approval is awaiting a decision from its requested reviewer");
        }
      }
      return service.update(project.id, request.params.approvalId, request.body, user.id);
    },
  );

  fastify.delete<{ Params: { id: string; approvalId: string } }>(
    "/projects/:id/approvals/:approvalId",
    { schema: { params: approvalParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "approvals", "manage");
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
