import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { importSessionsRepository } from "./repository.ts";
import {
  importSessionsService,
  type AttachDocumentInput,
} from "./service.ts";
import type { ImportDocStatus } from "./types.ts";

const DOC_KIND = ["programme", "boq", "drawing", "ifc", "project_file"] as const;
const DOC_STATUS = [
  "pending",
  "processing",
  "ready",
  "applied",
  "skipped",
  "failed",
] as const;

const sessionParams = {
  type: "object",
  required: ["sessionId"],
  additionalProperties: false,
  properties: { sessionId: { type: "string", minLength: 1 } },
} as const;

const documentParams = {
  type: "object",
  required: ["sessionId", "documentId"],
  additionalProperties: false,
  properties: {
    sessionId: { type: "string", minLength: 1 },
    documentId: { type: "string", minLength: 1 },
  },
} as const;

const linkProjectBody = {
  type: "object",
  required: ["projectId"],
  additionalProperties: false,
  properties: { projectId: { type: "string", minLength: 1 } },
} as const;

const attachBody = {
  type: "object",
  required: ["kind"],
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: DOC_KIND },
    jobId: { type: ["string", "null"], maxLength: 100 },
    fileName: { type: ["string", "null"], maxLength: 400 },
    status: { type: "string", enum: DOC_STATUS },
  },
} as const;

const updateDocBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    jobId: { type: ["string", "null"], maxLength: 100 },
    fileName: { type: ["string", "null"], maxLength: 400 },
    status: { type: "string", enum: DOC_STATUS },
    error: { type: ["string", "null"], maxLength: 2000 },
  },
} as const;

const importSessionRoutes: FastifyPluginAsync = async (fastify) => {
  const service = importSessionsService(importSessionsRepository(fastify.db));

  async function assertSessionAccess(sessionId: string, request: FastifyRequest) {
    const session = await service.detail(sessionId);
    if (session.projectId) {
      await request.requireProjectAccess(session.projectId);
    } else {
      request.requireAuth();
    }
    return session;
  }

  fastify.post("/import-sessions", async (request, reply) => {
    const user = request.requireAuth();
    const created = await service.create(user.id);
    return reply.status(201).send(created);
  });

  fastify.get<{ Params: { sessionId: string } }>(
    "/import-sessions/:sessionId",
    { schema: { params: sessionParams } },
    async (request) => {
      await assertSessionAccess(request.params.sessionId, request);
      return service.detail(request.params.sessionId);
    },
  );

  fastify.post<{ Params: { sessionId: string }; Body: { projectId: string } }>(
    "/import-sessions/:sessionId/project",
    { schema: { params: sessionParams, body: linkProjectBody } },
    async (request) => {
      await request.requireProjectWrite(request.body.projectId);
      return service.linkProject(request.params.sessionId, request.body.projectId);
    },
  );

  fastify.post<{ Params: { sessionId: string }; Body: AttachDocumentInput }>(
    "/import-sessions/:sessionId/documents",
    { schema: { params: sessionParams, body: attachBody } },
    async (request, reply) => {
      await assertSessionAccess(request.params.sessionId, request);
      const created = await service.attachDocument(request.params.sessionId, request.body);
      return reply.status(201).send(created);
    },
  );

  fastify.patch<{
    Params: { sessionId: string; documentId: string };
    Body: { jobId?: string | null; fileName?: string | null; status?: ImportDocStatus; error?: string | null };
  }>(
    "/import-sessions/:sessionId/documents/:documentId",
    { schema: { params: documentParams, body: updateDocBody } },
    async (request) => {
      await assertSessionAccess(request.params.sessionId, request);
      const body = request.body;
      return service.updateDocument(request.params.sessionId, request.params.documentId, {
        job_id: body.jobId,
        file_name: body.fileName,
        status: body.status,
        error: body.error,
      });
    },
  );
};

export default importSessionRoutes;
