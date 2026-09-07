import type { FastifyPluginAsync } from "fastify";
import { ForbiddenError } from "../../lib/errors.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { materialApprovalsRepository } from "./material-repository.ts";
import { materialApprovalsService } from "./material-service.ts";
import type {
  CreateMaterialApprovalInput,
  UpdateMaterialApprovalInput,
} from "./material-types.ts";
import { DECISION_STATUSES, type ApprovalStatus } from "./types.ts";

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

const materialFields = {
  materialName: { type: "string", minLength: 1, maxLength: 200 },
  specification: { type: ["string", "null"], maxLength: 4000 },
  quantity: { type: "number", minimum: 0 },
  unit: { type: "string", minLength: 1, maxLength: 40 },
  supplier: { type: ["string", "null"], maxLength: 200 },
  neededBy: { type: ["string", "null"], maxLength: 40 },
  phaseId: { type: ["string", "null"], maxLength: 100 },
  activityId: { type: ["string", "null"], maxLength: 100 },
} as const;

const createBody = {
  type: "object",
  required: ["title", "materialName"],
  additionalProperties: false,
  properties: {
    ...materialFields,
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 4000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    dueDate: { type: ["string", "null"], maxLength: 40 },
    requestedReviewerId: { type: ["string", "null"], maxLength: 100 },
    documentId: { type: ["string", "null"], maxLength: 100 },
    documentVersionId: { type: ["string", "null"], maxLength: 100 },
  },
} as const;

const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    ...materialFields,
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 4000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    status: { type: "string", enum: STATUS },
    response: { type: ["string", "null"], maxLength: 4000 },
    responseHtml: { type: ["string", "null"], maxLength: 200000 },
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

function isDecision(status: ApprovalStatus | undefined): boolean {
  return status !== undefined && DECISION_STATUSES.includes(status);
}

const materialApprovalRoutes: FastifyPluginAsync = async (fastify) => {
  const service = materialApprovalsService(materialApprovalsRepository(fastify.db), {
    notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue),
  });

  fastify.get<{ Params: { id: string }; Querystring: { status?: ApprovalStatus } }>(
    "/projects/:id/material-approvals",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "view");
      return service.list(project.id, request.query.status);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateMaterialApprovalInput }>(
    "/projects/:id/material-approvals",
    { schema: { params: projectIdParams, body: createBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(
        request.params.id,
        "materials",
        "request",
      );
      const user = request.requireAuth();
      const created = await service.create(project.id, request.body, user.id);
      return reply.status(201).send(created);
    },
  );

  fastify.get<{ Params: { id: string; approvalId: string } }>(
    "/projects/:id/material-approvals/:approvalId",
    { schema: { params: approvalParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "view");
      return service.get(project.id, request.params.approvalId);
    },
  );

  fastify.patch<{ Params: { id: string; approvalId: string }; Body: UpdateMaterialApprovalInput }>(
    "/projects/:id/material-approvals/:approvalId",
    { schema: { params: approvalParams, body: updateBody } },
    async (request) => {
      const user = request.requireAuth();
      // Recording the decision is materials:approve; amending the request
      // (spec, quantity, supplier, needed-by) stays with whoever may raise one.
      const deciding = isDecision(request.body.status);
      const project = await request.requireProjectPermission(
        request.params.id,
        "materials",
        deciding ? "approve" : "request",
      );
      // A request directed at a named reviewer is theirs to decide, exactly as
      // for client approvals — holding materials:approve is not a licence to
      // sign off somebody else's assignment.
      if (deciding) {
        const approval = await service.get(project.id, request.params.approvalId);
        if (approval.requestedReviewerId && approval.requestedReviewerId !== user.id) {
          throw new ForbiddenError(
            "This material approval is awaiting a decision from its requested reviewer",
          );
        }
      }
      return service.update(project.id, request.params.approvalId, request.body, user.id);
    },
  );

  fastify.delete<{ Params: { id: string; approvalId: string } }>(
    "/projects/:id/material-approvals/:approvalId",
    { schema: { params: approvalParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(
        request.params.id,
        "materials",
        "request",
      );
      await service.remove(project.id, request.params.approvalId);
      return reply.status(204).send();
    },
  );

  fastify.post<{ Params: { id: string; approvalId: string }; Body: { body: string } }>(
    "/projects/:id/material-approvals/:approvalId/comments",
    { schema: { params: approvalParams, body: commentBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "comments", "post");
      const user = request.requireAuth();
      const comment = await service.addComment(
        project.id,
        request.params.approvalId,
        request.body.body,
        { id: user.id, name: user.name },
      );
      return reply.status(201).send(comment);
    },
  );
};

export default materialApprovalRoutes;
