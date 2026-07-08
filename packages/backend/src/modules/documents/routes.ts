import type { FastifyPluginAsync } from "fastify";
import { openStoredFile } from "../../lib/file-storage.ts";
import { filesRepository } from "../files/repository.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { documentsRepository } from "./repository.ts";
import {
  documentsService,
  type AddVersionInput,
  type CreateDocumentInput,
  type EditDocumentInput,
} from "./service.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
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

const createDocumentBody = {
  type: "object",
  required: ["categoryId"],
  additionalProperties: false,
  properties: {
    categoryId: { type: "string", minLength: 1, maxLength: 100 },
    fileId: { type: "string", minLength: 1, maxLength: 100 },
    fileName: { type: "string", minLength: 1, maxLength: 255 },
    size: { type: "string", minLength: 1, maxLength: 50 },
    uploadedAt: { type: "string", minLength: 1, maxLength: 100 },
    status: { type: "string", enum: ["Verified", "Pending", "Expired"] },
  },
} as const;

const editDocumentBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    categoryId: { type: "string", minLength: 1, maxLength: 100 },
    fileName: { type: "string", minLength: 1, maxLength: 255 },
    status: { type: "string", enum: ["Verified", "Pending", "Expired"] },
  },
} as const;

const versionViewParams = {
  type: "object",
  required: ["id", "documentId", "versionId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    documentId: { type: "string", minLength: 1 },
    versionId: { type: "string", minLength: 1 },
  },
} as const;

const addVersionBody = {
  type: "object",
  required: ["fileId"],
  additionalProperties: false,
  properties: {
    fileId: { type: "string", minLength: 1, maxLength: 100 },
    revisionLabel: { type: "string", minLength: 1, maxLength: 50 },
    notes: { type: "string", maxLength: 1000 },
  },
} as const;

const documentRoutes: FastifyPluginAsync = async (fastify) => {
  const service = documentsService(
    documentsRepository(fastify.db),
    filesRepository(fastify.db),
    { notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue) },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/documents",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "documents", "view");
      return service.listByProject(project.id);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/documents/categories",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "documents", "view");
      return service.categoriesForProject(project.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateDocumentInput }>(
    "/projects/:id/documents",
    { schema: { params: projectIdParams, body: createDocumentBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "documents", "upload");
      const user = request.requireAuth();
      const doc = await service.create(project.id, request.body, user.id);
      return reply.status(201).send(doc);
    },
  );

  fastify.put<{
    Params: { id: string; documentId: string };
    Body: EditDocumentInput;
  }>(
    "/projects/:id/documents/:documentId",
    { schema: { params: documentParams, body: editDocumentBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "documents", "upload");
      return service.edit(project.id, request.params.documentId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; documentId: string } }>(
    "/projects/:id/documents/:documentId",
    { schema: { params: documentParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "documents", "delete");
      await service.remove(project.id, request.params.documentId);
      return reply.status(204).send();
    },
  );

  // --- Versions / revisions ---
  fastify.get<{ Params: { id: string; documentId: string } }>(
    "/projects/:id/documents/:documentId/versions",
    { schema: { params: documentParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "documents", "view");
      return service.listVersions(project.id, request.params.documentId);
    },
  );

  fastify.post<{ Params: { id: string; documentId: string }; Body: AddVersionInput }>(
    "/projects/:id/documents/:documentId/versions",
    { schema: { params: documentParams, body: addVersionBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "documents", "upload");
      const user = request.requireAuth();
      const version = await service.addVersion(
        project.id,
        request.params.documentId,
        request.body,
        user.id,
      );
      return reply.status(201).send(version);
    },
  );

  // Inline file view for a specific version (project-scoped, not file-owner-scoped).
  fastify.get<{ Params: { id: string; documentId: string; versionId: string } }>(
    "/projects/:id/documents/:documentId/versions/:versionId/view",
    { schema: { params: versionViewParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "documents", "view");
      const file = await service.resolveVersionFile(
        project.id,
        request.params.documentId,
        request.params.versionId,
      );
      const stream = await openStoredFile(file.storagePath);
      reply.header("Content-Type", file.mimeType);
      reply.header(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(file.fileName)}"`,
      );
      return reply.send(stream);
    },
  );
};

export default documentRoutes;
