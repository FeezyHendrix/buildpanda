import type { FastifyPluginAsync } from "fastify";
import { preconRepository } from "../panda-ai/pdf-takeoff/repository.ts";
import { preconService } from "../panda-ai/pdf-takeoff/service.ts";
import { drawingMarkupRepository } from "./repository.ts";
import { drawingMarkupService } from "./service.ts";
import {
  MARKUP_KINDS,
  MEDIA_KINDS,
  type CreateCommentInput,
  type CreateMarkupInput,
  type CreatePreconMarkupInput,
} from "./types.ts";

const projectIdParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

const markupParams = {
  type: "object",
  required: ["id", "markupId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    markupId: { type: "string", minLength: 1 },
  },
} as const;

const documentParams = {
  type: "object",
  required: ["id", "documentId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    documentId: { type: "string", minLength: 1 },
  },
} as const;

const listQuery = {
  type: "object",
  required: ["documentVersionId"],
  additionalProperties: false,
  properties: {
    documentVersionId: { type: "string", minLength: 1 },
    pageNo: { type: "integer", minimum: 1 },
  },
} as const;

const point = {
  type: "object",
  required: ["x", "y"],
  additionalProperties: false,
  properties: { x: { type: "number" }, y: { type: "number" } },
} as const;

const geometry = {
  type: "object",
  required: ["kind"],
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: MARKUP_KINDS },
    at: point,
    a: point,
    b: point,
    points: { type: "array", maxItems: 1000, items: point },
    rect: {
      type: "object",
      required: ["x", "y", "w", "h"],
      additionalProperties: false,
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        w: { type: "number" },
        h: { type: "number" },
      },
    },
  },
} as const;

const createMarkupBody = {
  type: "object",
  required: ["documentId", "documentVersionId", "kind", "geometry"],
  additionalProperties: false,
  properties: {
    documentId: { type: "string", minLength: 1, maxLength: 100 },
    documentVersionId: { type: "string", minLength: 1, maxLength: 100 },
    pageNo: { type: "integer", minimum: 1 },
    kind: { type: "string", enum: MARKUP_KINDS },
    geometry,
    color: { type: "string", minLength: 1, maxLength: 20 },
  },
} as const;

const createCommentBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: {
    body: { type: "string", minLength: 1, maxLength: 4000 },
    bodyHtml: { type: ["string", "null"], maxLength: 200000 },
    mediaKind: { type: ["string", "null"], enum: [...MEDIA_KINDS, null] },
    fileId: { type: ["string", "null"], maxLength: 100 },
    mediaDurationSeconds: { type: ["integer", "null"], minimum: 0 },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
  },
} as const;

const resolveBody = {
  type: "object",
  required: ["resolved"],
  additionalProperties: false,
  properties: { resolved: { type: "boolean" } },
} as const;

// ── WS-M1D: markups on take-off sheets ────────────────────────────────────

const sessionParams = {
  type: "object",
  required: ["sessionId"],
  additionalProperties: false,
  properties: { sessionId: { type: "string", minLength: 1 } },
} as const;

const preconMarkupParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

const sessionListQuery = {
  type: "object",
  additionalProperties: false,
  properties: { sheetId: { type: "string", minLength: 1 } },
} as const;

const createPreconMarkupBody = {
  type: "object",
  required: ["sheetId", "kind", "geometry"],
  additionalProperties: false,
  properties: {
    sheetId: { type: "string", minLength: 1, maxLength: 100 },
    rowId: { type: ["string", "null"], maxLength: 100 },
    kind: { type: "string", enum: MARKUP_KINDS },
    geometry,
    color: { type: "string", minLength: 1, maxLength: 20 },
  },
} as const;

const drawingMarkupRoutes: FastifyPluginAsync = async (fastify) => {
  const service = drawingMarkupService(
    drawingMarkupRepository(fastify.db),
    preconService(preconRepository(fastify.db)),
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

  fastify.get<{ Params: { sessionId: string }; Querystring: { sheetId?: string } }>(
    "/precon/sessions/:sessionId/markups",
    { schema: { params: sessionParams, querystring: sessionListQuery } },
    async (request) => {
      const orgId = request.requireOrgPermission("takeoffs", "view");
      await service.assertPreconSessionOrg(request.params.sessionId, orgId);
      return service.listForSession(request.params.sessionId, request.query.sheetId);
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

  fastify.delete<{ Params: { id: string } }>(
    "/precon/markups/:id",
    { schema: { params: preconMarkupParams } },
    async (request) => {
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.preconSessionOf(request.params.id, orgId);
      await service.remove(request.params.id);
      return { ok: true };
    },
  );
};

export default drawingMarkupRoutes;
