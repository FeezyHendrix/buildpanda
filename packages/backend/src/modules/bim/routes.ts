import type { FastifyPluginAsync } from "fastify";
import { idParams as projectIdParams } from "../../lib/schemas.ts";
import { rfisRepository } from "../rfis/repository.ts";
import { rfisService } from "../rfis/service.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { bimRepository } from "./repository.ts";
import { bimService } from "./service.ts";
import { BIM_PROCESS_QUEUE } from "./job.ts";
import { BIM_LINK_TYPES } from "./types.ts";

const modelParams = {
  type: "object",
  required: ["id", "modelId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    modelId: { type: "string", minLength: 1 },
  },
} as const;

const uploadTicketBody = {
  type: "object",
  required: ["fileName", "sizeBytes"],
  additionalProperties: false,
  properties: {
    fileName: { type: "string", minLength: 1, maxLength: 300 },
    sizeBytes: { type: "integer", minimum: 1 },
  },
} as const;

const completeUploadBody = {
  type: "object",
  required: ["storagePath", "uploadId", "parts"],
  additionalProperties: false,
  properties: {
    storagePath: { type: "string", minLength: 1, maxLength: 500 },
    uploadId: { type: "string", minLength: 1, maxLength: 500 },
    parts: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["partNumber", "etag"],
        additionalProperties: false,
        properties: {
          partNumber: { type: "integer", minimum: 1 },
          etag: { type: "string", minLength: 1, maxLength: 200 },
        },
      },
    },
  },
} as const;

const abortUploadBody = {
  type: "object",
  required: ["storagePath", "uploadId"],
  additionalProperties: false,
  properties: {
    storagePath: { type: "string", minLength: 1, maxLength: 500 },
    uploadId: { type: "string", minLength: 1, maxLength: 500 },
  },
} as const;

const registerModelBody = {
  type: "object",
  required: ["name", "fileName", "storagePath"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    discipline: { type: ["string", "null"], maxLength: 80 },
    fileName: { type: "string", minLength: 1, maxLength: 300 },
    storagePath: { type: "string", minLength: 1, maxLength: 500 },
    sizeBytes: { type: ["integer", "null"], minimum: 0 },
  },
} as const;

const createIssueBody = {
  type: "object",
  required: ["title"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 4000 },
    elementGuid: { type: ["string", "null"], maxLength: 100 },
    position: { type: ["object", "null"] },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
  },
} as const;

const issueParams = {
  type: "object",
  required: ["id", "modelId", "issueId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    modelId: { type: "string", minLength: 1 },
    issueId: { type: "string", minLength: 1 },
  },
} as const;

const updateIssueBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 4000 },
    status: { type: "string", enum: ["Open", "Closed"] },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
  },
} as const;

const createLinkBody = {
  type: "object",
  required: ["elementGuid", "linkType", "targetId"],
  additionalProperties: false,
  properties: {
    elementGuid: { type: "string", minLength: 1, maxLength: 100 },
    linkType: { type: "string", enum: BIM_LINK_TYPES },
    targetId: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

const linkParams = {
  type: "object",
  required: ["id", "modelId", "linkId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    modelId: { type: "string", minLength: 1 },
    linkId: { type: "string", minLength: 1 },
  },
} as const;

const bimRoutes: FastifyPluginAsync = async (fastify) => {
  const service = bimService(
    bimRepository(fastify.db),
    (versionId) => fastify.queue.enqueue(BIM_PROCESS_QUEUE, "extract", { versionId }),
    {
      rfis: rfisService(rfisRepository(fastify.db)),
      notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue),
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/bim/models",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.list(project.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: { fileName: string; sizeBytes: number } }>(
    "/projects/:id/bim/upload-url",
    { schema: { params: projectIdParams, body: uploadTicketBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "bim", "upload");
      const user = request.requireAuth();
      void project;
      const ticket = await service.createUploadTicket(user.id, request.body);
      return reply.status(201).send(ticket);
    },
  );

  fastify.post<{
    Params: { id: string };
    Body: { storagePath: string; uploadId: string; parts: { partNumber: number; etag: string }[] };
  }>(
    "/projects/:id/bim/complete-upload",
    { schema: { params: projectIdParams, body: completeUploadBody } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "bim", "upload");
      await service.completeUpload(request.body.storagePath, request.body.uploadId, request.body.parts);
      return { ok: true };
    },
  );

  fastify.post<{ Params: { id: string }; Body: { storagePath: string; uploadId: string } }>(
    "/projects/:id/bim/abort-upload",
    { schema: { params: projectIdParams, body: abortUploadBody } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "bim", "upload");
      await service.abortUpload(request.body.storagePath, request.body.uploadId);
      return { ok: true };
    },
  );

  fastify.post<{
    Params: { id: string };
    Body: { name: string; discipline?: string | null; fileName: string; storagePath: string; sizeBytes?: number | null };
  }>(
    "/projects/:id/bim/models",
    { schema: { params: projectIdParams, body: registerModelBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "bim", "upload");
      const user = request.requireAuth();
      const model = await service.registerModel(project.id, request.body, user.id);
      return reply.status(201).send(model);
    },
  );

  fastify.get<{ Params: { id: string; modelId: string } }>(
    "/projects/:id/bim/models/:modelId",
    { schema: { params: modelParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.get(project.id, request.params.modelId);
    },
  );

  fastify.get<{ Params: { id: string; modelId: string } }>(
    "/projects/:id/bim/models/:modelId/file-url",
    { schema: { params: modelParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.modelFileUrl(project.id, request.params.modelId);
    },
  );

  fastify.get<{ Params: { id: string; modelId: string } }>(
    "/projects/:id/bim/models/:modelId/xkt-url",
    { schema: { params: modelParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.modelXktUrl(project.id, request.params.modelId);
    },
  );

  fastify.get<{ Params: { id: string; modelId: string } }>(
    "/projects/:id/bim/models/:modelId/issues",
    { schema: { params: modelParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.listIssues(project.id, request.params.modelId);
    },
  );

  fastify.post<{
    Params: { id: string; modelId: string };
    Body: { title: string; description?: string | null; elementGuid?: string | null; position?: unknown; assigneeId?: string | null };
  }>(
    "/projects/:id/bim/models/:modelId/issues",
    { schema: { params: modelParams, body: createIssueBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "bim", "manage");
      const user = request.requireAuth();
      const issue = await service.createIssue(project.id, request.params.modelId, request.body, user.id);
      return reply.status(201).send(issue);
    },
  );

  fastify.get<{ Params: { id: string; modelId: string } }>(
    "/projects/:id/bim/models/:modelId/links",
    { schema: { params: modelParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      return service.listLinks(project.id, request.params.modelId);
    },
  );

  fastify.patch<{
    Params: { id: string; modelId: string; issueId: string };
    Body: { title?: string; description?: string | null; status?: "Open" | "Closed"; assigneeId?: string | null };
  }>(
    "/projects/:id/bim/models/:modelId/issues/:issueId",
    { schema: { params: issueParams, body: updateIssueBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "bim", "manage");
      const user = request.requireAuth();
      return service.updateIssue(project.id, request.params.modelId, request.params.issueId, request.body, user.id);
    },
  );

  fastify.post<{ Params: { id: string; modelId: string; issueId: string } }>(
    "/projects/:id/bim/models/:modelId/issues/:issueId/promote-to-rfi",
    { schema: { params: issueParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "rfis", "create");
      const user = request.requireAuth();
      const issue = await service.promoteIssueToRfi(
        project.id,
        request.params.modelId,
        request.params.issueId,
        { id: user.id, name: user.name },
      );
      return reply.status(201).send(issue);
    },
  );

  fastify.post<{
    Params: { id: string; modelId: string };
    Body: { elementGuid: string; linkType: (typeof BIM_LINK_TYPES)[number]; targetId: string };
  }>(
    "/projects/:id/bim/models/:modelId/links",
    { schema: { params: modelParams, body: createLinkBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "bim", "manage");
      const link = await service.addLink(project.id, request.params.modelId, request.body);
      return reply.status(201).send(link);
    },
  );

  fastify.delete<{ Params: { id: string; modelId: string; linkId: string } }>(
    "/projects/:id/bim/models/:modelId/links/:linkId",
    { schema: { params: linkParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "bim", "manage");
      await service.removeLink(project.id, request.params.modelId, request.params.linkId);
      return reply.status(204).send();
    },
  );
};

export default bimRoutes;
