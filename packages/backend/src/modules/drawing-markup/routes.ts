import type { FastifyPluginAsync } from "fastify";
import { registerProjectMarkupAccess } from "./project-access.ts";
import { validatorFor } from "../../plugins/request-validation.ts";
import { preconAuditRepository } from "../panda-ai/pdf-takeoff/audit-repository.ts";
import { preconRepository } from "../panda-ai/pdf-takeoff/repository.ts";
import { preconService } from "../panda-ai/pdf-takeoff/service.ts";
import { drawingMarkupRepository } from "./repository.ts";
import { drawingMarkupService } from "./service.ts";
import { projectIdParams, markupParams, documentParams, listQuery, createMarkupBody, createCommentBody, resolveBody, sessionParams, preconMarkupParams, preconCommentParams, sessionListQuery, deleteMarkupQuery, editMarkupBody, editCommentBody, createPreconMarkupBody } from "./route-schemas.ts";
import {
  type CreateCommentInput,
  type CreateMarkupInput,
  type CreatePreconMarkupInput,
  type EditCommentInput,
  type EditMarkupInput,
} from "./types.ts";

const drawingMarkupRoutes: FastifyPluginAsync = async (fastify) => {
  registerProjectMarkupAccess(fastify);
  // A markup anchors to a point, so a `null` must never be coerced into a 0
  // nobody clicked. Encapsulated: binds THIS subtree, not its siblings.
  fastify.setValidatorCompiler(validatorFor);

  const service = drawingMarkupService(
    drawingMarkupRepository(fastify.db),
    preconService(preconRepository(fastify.db)),
    preconAuditRepository(fastify.db),
  );

  fastify.get<{ Params: { id: string }; Querystring: { documentVersionId: string; pageNo?: number } }>(
    "/projects/:id/drawing-markups",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "documents", "view");
      return service.listForVersion(request.query.documentVersionId, request.query.pageNo);
    },
  );

  fastify.get<{ Params: { id: string; documentId: string } }>(
    "/projects/:id/documents/:documentId/drawing-markups",
    { schema: { params: documentParams } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "documents", "view");
      return service.listForDocument(request.params.documentId);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateMarkupInput }>(
    "/projects/:id/drawing-markups",
    { schema: { params: projectIdParams, body: createMarkupBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(
        request.params.id,
        "documents",
        "markup",
      );
      const user = request.requireAuth();
      const markup = await service.create(project.id, user.id, request.body);
      return reply.status(201).send(markup);
    },
  );

  fastify.post<{ Params: { id: string; markupId: string }; Body: CreateCommentInput }>(
    "/projects/:id/drawing-markups/:markupId/comments",
    { schema: { params: markupParams, body: createCommentBody } },
    async (request, reply) => {
      await request.requireProjectPermission(request.params.id, "documents", "markup");
      const user = request.requireAuth();
      const comment = await service.addComment(request.params.markupId, user.id, request.body);
      return reply.status(201).send(comment);
    },
  );

  fastify.patch<{ Params: { id: string; markupId: string }; Body: { resolved: boolean } }>(
    "/projects/:id/drawing-markups/:markupId/resolve",
    { schema: { params: markupParams, body: resolveBody } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "documents", "markup");
      const user = request.requireAuth();
      return service.setResolved(request.params.markupId, user.id, request.body.resolved);
    },
  );

  fastify.delete<{ Params: { id: string; markupId: string } }>(
    "/projects/:id/drawing-markups/:markupId",
    { schema: { params: markupParams } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "documents", "markup");
      await service.remove(request.params.markupId);
      return { ok: true };
    },
  );

  // ── WS-M1D: pinned comments on take-off sheets (org-scoped via the session) ──

  fastify.get<{
    Params: { sessionId: string };
    Querystring: { sheetId?: string; includeDeleted?: boolean };
  }>(
    "/precon/sessions/:sessionId/markups",
    { schema: { params: sessionParams, querystring: sessionListQuery } },
    async (request) => {
      const orgId = request.requireOrgPermission("takeoffs", "view");
      await service.assertPreconSessionOrg(request.params.sessionId, orgId);
      return service.listForSession(
        request.params.sessionId,
        request.query.sheetId,
        request.query.includeDeleted,
      );
    },
  );

  fastify.post<{ Params: { sessionId: string }; Body: CreatePreconMarkupInput }>(
    "/precon/sessions/:sessionId/markups",
    { schema: { params: sessionParams, body: createPreconMarkupBody } },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      const user = request.requireAuth();
      const markup = await service.createForSession(request.params.sessionId, orgId, user.id, request.body);
      return reply.status(201).send(markup);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateCommentInput }>(
    "/precon/markups/:id/comments",
    { schema: { params: preconMarkupParams, body: createCommentBody } },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      const user = request.requireAuth();
      await service.preconSessionOf(request.params.id, orgId);
      const comment = await service.addComment(request.params.id, user.id, request.body);
      return reply.status(201).send(comment);
    },
  );

  fastify.post<{ Params: { id: string }; Body: { resolved: boolean } }>(
    "/precon/markups/:id/resolve",
    { schema: { params: preconMarkupParams, body: resolveBody } },
    async (request) => {
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      const user = request.requireAuth();
      await service.preconSessionOf(request.params.id, orgId);
      return service.setResolved(request.params.id, user.id, request.body.resolved);
    },
  );

  fastify.patch<{ Params: { id: string }; Body: EditMarkupInput }>(
    "/precon/markups/:id",
    { schema: { params: preconMarkupParams, body: editMarkupBody } },
    async (request) => {
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      const user = request.requireAuth();
      await service.preconSessionOf(request.params.id, orgId);
      return service.editMarkup(request.params.id, user.id, request.body);
    },
  );

  fastify.patch<{ Params: { id: string; commentId: string }; Body: EditCommentInput }>(
    "/precon/markups/:id/comments/:commentId",
    { schema: { params: preconCommentParams, body: editCommentBody } },
    async (request) => {
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      const user = request.requireAuth();
      await service.preconSessionOf(request.params.id, orgId);
      return service.editComment(
        request.params.id,
        request.params.commentId,
        user.id,
        request.body,
      );
    },
  );

  // Withdrawn, not erased: the pin and its thread stay on the record and can be
  // offered back, because an RFI may already have been raised off them.
  fastify.delete<{ Params: { id: string }; Querystring: { version: number } }>(
    "/precon/markups/:id",
    { schema: { params: preconMarkupParams, querystring: deleteMarkupQuery } },
    async (request) => {
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      const user = request.requireAuth();
      await service.preconSessionOf(request.params.id, orgId);
      return service.softDeleteMarkup(request.params.id, user.id, request.query.version);
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/precon/markups/:id/restore",
    { schema: { params: preconMarkupParams } },
    async (request) => {
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      const user = request.requireAuth();
      await service.preconSessionOf(request.params.id, orgId);
      return service.restoreMarkup(request.params.id, user.id);
    },
  );
};

export default drawingMarkupRoutes;
