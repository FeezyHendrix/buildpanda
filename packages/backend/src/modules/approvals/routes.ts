import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { ForbiddenError } from "../../lib/errors.ts";
import { canProjectPermission } from "../../lib/authorization.ts";
import { documentsRepository } from "../documents/repository.ts";
import { documentsService } from "../documents/service.ts";
import { filesRepository } from "../files/repository.ts";
import { filesService } from "../files/service.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import type { ProjectRow } from "../projects/types.ts";
import { approvalsRepository } from "./repository.ts";
import {
  approvalsService,
  type ApprovalProject,
  type CreateApprovalInput,
  type ResubmitApprovalInput,
  type UpdateApprovalInput,
} from "./service.ts";
import { APPROVAL_SORTS, type ApprovalListQuery, type ApprovalStatus, type ApprovalViewer } from "./types.ts";
import type { AttachmentPick } from "./attachments.ts";

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

const day = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } as const;

// `page` switches the response from the plain array to the paged shape.
const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "array", items: { type: "string", enum: STATUS }, maxItems: 4 },
    q: { type: "string", maxLength: 200 },
    needsMyDecision: { type: "boolean" },
    submittedFrom: day,
    submittedTo: day,
    page: { type: "integer", minimum: 1 },
    pageSize: { type: "integer", minimum: 1, maximum: 50 },
    sort: { type: "string", enum: APPROVAL_SORTS },
  },
} as const;

const attachmentPick = {
  type: "object",
  additionalProperties: false,
  properties: {
    fileId: { type: "string", minLength: 1, maxLength: 100 },
    documentId: { type: "string", minLength: 1, maxLength: 100 },
    documentVersionId: { type: "string", minLength: 1, maxLength: 100 },
  },
  oneOf: [{ required: ["fileId"] }, { required: ["documentId", "documentVersionId"] }],
} as const;

const attachments = { type: "array", maxItems: 5, items: attachmentPick } as const;

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
    documentId: { type: ["string", "null"], maxLength: 100 },
    documentVersionId: { type: ["string", "null"], maxLength: 100 },
    sourceMarkupId: { type: ["string", "null"], maxLength: 100 },
    attachments,
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
    responseHtml: { type: ["string", "null"], maxLength: 200000 },
    dueDate: { type: ["string", "null"], maxLength: 40 },
    requestedReviewerId: { type: ["string", "null"], maxLength: 100 },
  },
} as const;

const resubmitBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    description: { type: ["string", "null"], maxLength: 4000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    attachments,
  },
} as const;

const attachmentsBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    add: attachments,
    remove: { type: "array", maxItems: 20, items: { type: "string", minLength: 1, maxLength: 100 } },
  },
} as const;

const categoriesBody = {
  type: "object",
  required: ["names"],
  additionalProperties: false,
  properties: { names: { type: "array", maxItems: 50, items: { type: "string", minLength: 1, maxLength: 80 } } },
} as const;

const commentBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: { body: { type: "string", minLength: 1, maxLength: 2000 } },
} as const;

const toProject = (p: ProjectRow): ApprovalProject => ({
  id: p.id,
  ownerId: p.owner_id,
  organizationId: p.organization_id,
  startDate: p.start_date ? String(p.start_date).slice(0, 10) : null,
});

const approvalRoutes: FastifyPluginAsync = async (fastify) => {
  const service = approvalsService(approvalsRepository(fastify.db), {
    notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue),
    files: filesService(filesRepository(fastify.db)),
    documents: documentsService(documentsRepository(fastify.db), filesRepository(fastify.db)),
  });

  // The same inputs assertProjectPermission composes, so what the response says
  // the caller may do is exactly what the guards below will let them do.
  function viewer(request: FastifyRequest, project: ProjectRow): ApprovalViewer {
    const user = request.requireAuth();
    const scope = { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id };
    const ctx = {
      userId: user.id,
      orgRoles: request.orgRoles,
      projectRoles: request.projectRoles,
      orgPermissions: request.orgPermissions,
      projectSectionPermissions: request.projectSectionPermissions,
      projectGrants: request.projectGrants,
    };
    return {
      id: user.id,
      canDecide: canProjectPermission(scope, ctx, "approvals", "decide"),
      canOpenFiles: canProjectPermission(scope, ctx, "documents", "view"),
    };
  }

  fastify.get<{ Params: { id: string }; Querystring: ApprovalListQuery }>(
    "/projects/:id/approvals",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "approvals", "view");
      const v = viewer(request, project);
      const q = request.query;
      const paged = q.page !== undefined || q.q !== undefined || q.needsMyDecision !== undefined || q.submittedFrom !== undefined || q.submittedTo !== undefined || q.sort !== undefined;
      if (paged) return service.page(project.id, q, v);
      return service.list(project.id, v, q.status?.[0] as ApprovalStatus | undefined);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/approvals/approvers",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "approvals", "view");
      return service.approvers(toProject(project));
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/approval-categories",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "approvals", "view");
      return service.categories(project.id);
    },
  );

  fastify.put<{ Params: { id: string }; Body: { names: string[] } }>(
    "/projects/:id/approval-categories",
    { schema: { params: projectIdParams, body: categoriesBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "approvals", "manage");
      return service.replaceCategories(project.id, request.body.names);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateApprovalInput }>(
    "/projects/:id/approvals",
    { schema: { params: projectIdParams, body: createBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "approvals", "manage");
      const user = request.requireAuth();
      const created = await service.create(toProject(project), request.body, user.id, viewer(request, project));
      return reply.status(201).send(created);
    },
  );

  fastify.get<{ Params: { id: string; approvalId: string } }>(
    "/projects/:id/approvals/:approvalId",
    { schema: { params: approvalParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "approvals", "view");
      return service.get(project.id, request.params.approvalId, viewer(request, project));
    },
  );

  fastify.patch<{ Params: { id: string; approvalId: string }; Body: UpdateApprovalInput }>(
    "/projects/:id/approvals/:approvalId",
    { schema: { params: approvalParams, body: updateBody } },
    async (request) => {
      const user = request.requireAuth();
      // Homeowner (client), company staff, or any participant granted
      // approvals:decide via role default or section matrix.
      const project = await request.requireProjectPermission(request.params.id, "approvals", "decide");
      const v = viewer(request, project);
      // If the approval was directed at a specific reviewer, only that person may
      // record the decision (status change). Editing other fields stays open to
      // the baseline set above.
      const decidingStatus = request.body.status !== undefined && ["Approved", "Rejected", "Resubmit"].includes(request.body.status);
      if (decidingStatus) {
        const approval = await service.get(project.id, request.params.approvalId, v);
        if (approval.requestedReviewerId && approval.requestedReviewerId !== user.id) {
          throw new ForbiddenError("This approval is awaiting a decision from its requested reviewer");
        }
      }
      return service.update(toProject(project), request.params.approvalId, request.body, user.id, v);
    },
  );

  fastify.post<{ Params: { id: string; approvalId: string }; Body: ResubmitApprovalInput }>(
    "/projects/:id/approvals/:approvalId/resubmit",
    { schema: { params: approvalParams, body: resubmitBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "approvals", "manage");
      const user = request.requireAuth();
      return service.resubmit(toProject(project), request.params.approvalId, request.body, user.id, viewer(request, project));
    },
  );

  fastify.patch<{ Params: { id: string; approvalId: string }; Body: { add?: AttachmentPick[]; remove?: string[] } }>(
    "/projects/:id/approvals/:approvalId/attachments",
    { schema: { params: approvalParams, body: attachmentsBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "approvals", "manage");
      const user = request.requireAuth();
      return service.changeAttachments(toProject(project), request.params.approvalId, request.body, user.id, viewer(request, project));
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
      const comment = await service.addComment(project.id, request.params.approvalId, request.body.body, { id: user.id, name: user.name });
      return reply.status(201).send(comment);
    },
  );
};

export default approvalRoutes;
