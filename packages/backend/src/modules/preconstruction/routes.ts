import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { config } from "../../config/index.ts";
import { BadRequestError } from "../../lib/errors.ts";
import { saveStream } from "../../lib/file-storage.ts";
import { preconRepository } from "./repository.ts";
import { preconService } from "./service.ts";
import { PRECON_GENERATE_QUEUE, type PreconGenerateJobData } from "./job.ts";
import { GEOMETRY_KINDS } from "./types.ts";
import type { AddDeductionBody, UpdateGeometryBody, UpdateRowBody } from "./types.ts";

const idParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

const sessionParams = {
  type: "object",
  required: ["id", "sessionId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    sessionId: { type: "string", minLength: 1 },
  },
} as const;

const rowParams = {
  type: "object",
  required: ["id", "rowId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    rowId: { type: "string", minLength: 1 },
  },
} as const;

const updateRowBody = {
  type: "object",
  required: ["version", "changes"],
  additionalProperties: false,
  properties: {
    version: { type: "integer", minimum: 1 },
    changes: {
      type: "object",
      additionalProperties: false,
      minProperties: 1,
      properties: {
        description: { type: "string", maxLength: 4000 },
        qty: { type: "number", minimum: 0 },
        rate: { type: "number", minimum: 0 },
        unit: { type: "string", maxLength: 20 },
      },
    },
  },
} as const;

const versionOnlyBody = {
  type: "object",
  required: ["version"],
  additionalProperties: false,
  properties: { version: { type: "integer", minimum: 1 } },
} as const;

const vertices = {
  type: "array",
  minItems: 1,
  maxItems: 2000,
  items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } },
} as const;

const updateGeometryBody = {
  type: "object",
  required: ["version", "kind", "vertices"],
  additionalProperties: false,
  properties: {
    version: { type: "integer", minimum: 1 },
    kind: { type: "string", enum: GEOMETRY_KINDS },
    vertices,
  },
} as const;

const addDeductionBody = {
  type: "object",
  required: ["version", "label", "vertices"],
  additionalProperties: false,
  properties: {
    version: { type: "integer", minimum: 1 },
    label: { type: "string", minLength: 1, maxLength: 200 },
    vertices,
  },
} as const;

const createSessionQuery = {
  type: "object",
  additionalProperties: false,
  properties: { title: { type: "string", maxLength: 200 } },
} as const;

const preconRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: { fileSize: config.uploads.maxFileBytes, files: 10 },
  });

  const service = preconService(preconRepository(fastify.db), (sessionId, event) => {
    fastify.realtime.publish({ event: event.type, channelId: `precon:${sessionId}`, data: event });
  });

  fastify.post<{ Params: { id: string }; Querystring: { title?: string } }>(
    "/projects/:id/precon/sessions",
    { schema: { params: idParams, querystring: createSessionQuery } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "request");
      const user = request.requireAuth();
      const files: { fileName: string; storagePath: string }[] = [];
      for await (const part of request.files()) {
        if (!/\.(pdf|dwg)$/i.test(part.filename)) {
          throw new BadRequestError("Preconstruction accepts PDF or DWG drawings");
        }
        const stored = await saveStream(user.id, part.file);
        files.push({ fileName: part.filename, storagePath: stored.storagePath });
      }
      if (files.length === 0) throw new BadRequestError("No drawing files uploaded");
      const session = await service.createSession(
        project.id,
        request.query.title ?? files[0]!.fileName,
        user.id,
        files,
      );
      const jobData: PreconGenerateJobData = { sessionId: session.id };
      await fastify.queue.enqueue(PRECON_GENERATE_QUEUE, "generate", jobData);
      return reply.status(202).send(session);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/precon/sessions",
    { schema: { params: idParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "project", "view");
      return service.listSessions(project.id);
    },
  );

  fastify.get<{ Params: { id: string; sessionId: string } }>(
    "/projects/:id/precon/sessions/:sessionId",
    { schema: { params: sessionParams } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "project", "view");
      return service.getSnapshot(request.params.sessionId);
    },
  );

  fastify.patch<{ Params: { id: string; rowId: string }; Body: UpdateRowBody }>(
    "/projects/:id/precon/rows/:rowId",
    { schema: { params: rowParams, body: updateRowBody } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "materials", "request");
      const user = request.requireAuth();
      return service.updateRow(request.params.rowId, request.body, user.id);
    },
  );

  fastify.post<{ Params: { id: string; rowId: string }; Body: { version: number } }>(
    "/projects/:id/precon/rows/:rowId/verify",
    { schema: { params: rowParams, body: versionOnlyBody } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "materials", "request");
      const user = request.requireAuth();
      return service.verifyRow(request.params.rowId, request.body.version, user.id);
    },
  );

  fastify.post<{ Params: { id: string; rowId: string }; Body: { version: number } }>(
    "/projects/:id/precon/rows/:rowId/reject",
    { schema: { params: rowParams, body: versionOnlyBody } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "materials", "request");
      const user = request.requireAuth();
      return service.rejectRow(request.params.rowId, request.body.version, user.id);
    },
  );

  fastify.put<{ Params: { id: string; rowId: string }; Body: UpdateGeometryBody }>(
    "/projects/:id/precon/rows/:rowId/geometry",
    { schema: { params: rowParams, body: updateGeometryBody } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "materials", "request");
      const user = request.requireAuth();
      return service.updateGeometry(request.params.rowId, request.body, user.id);
    },
  );

  fastify.post<{ Params: { id: string; rowId: string }; Body: AddDeductionBody }>(
    "/projects/:id/precon/rows/:rowId/deductions",
    { schema: { params: rowParams, body: addDeductionBody } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "materials", "request");
      const user = request.requireAuth();
      return service.addDeduction(request.params.rowId, request.body, user.id);
    },
  );
};

export default preconRoutes;
