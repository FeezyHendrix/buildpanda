import type { FastifyPluginAsync } from "fastify";
import { buildMaterialApprovalsService } from "./material-wiring.ts";
import { authorizeMaterialApprovalUpdate, authorizeMaterialApprovalDelete } from "./material-access.ts";
import type {
  CreateMaterialApprovalInput,
  ResubmitMaterialApprovalInput,
  UpdateMaterialApprovalInput,
} from "./material-types.ts";
import type { ApprovalStatus } from "./types.ts";

import { projectIdParams, approvalParams, listQuery, createBody, updateBody, resubmitBody, commentBody } from "./material-schemas.ts";

const materialApprovalRoutes: FastifyPluginAsync = async (fastify) => {
  const service = buildMaterialApprovalsService(fastify.db, fastify.queue);

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
      const project = await authorizeMaterialApprovalUpdate(request, service, request.params.id, request.params.approvalId, request.body);
      return service.update(project.id, request.params.approvalId, request.body, user.id);
    },
  );

  // The decided record stays as it is; this raises the replacement request and
  // links it back, which is what "raise a new request" meant all along.
  fastify.post<{ Params: { id: string; approvalId: string }; Body: ResubmitMaterialApprovalInput }>(
    "/projects/:id/material-approvals/:approvalId/resubmit",
    { schema: { params: approvalParams, body: resubmitBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(
        request.params.id,
        "materials",
        "request",
      );
      const user = request.requireAuth();
      const created = await service.resubmit(
        project.id,
        request.params.approvalId,
        request.body ?? {},
        user.id,
      );
      return reply.status(201).send(created);
    },
  );

  fastify.delete<{ Params: { id: string; approvalId: string } }>(
    "/projects/:id/material-approvals/:approvalId",
    { schema: { params: approvalParams } },
    async (request, reply) => {
      const project = await authorizeMaterialApprovalDelete(request, service, request.params.id, request.params.approvalId);
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
