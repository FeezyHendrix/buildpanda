import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { MAX_VOICE_NOTE_BYTES, MAX_VOICE_NOTE_SECONDS } from "@buildpanda/rich-content";
import { BadRequestError } from "../../lib/errors.ts";
import type { UpdatesService } from "./service.ts";
import type { AddCommentInput, UpdateCommentParams } from "./types.ts";

const params = { type: "object", required: ["id", "updateId"], additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 }, updateId: { type: "string", minLength: 1 } } } as const;
const comment = { type: "object", properties: {
  id: { type: "string" }, updateId: { type: "string" }, body: { type: "string" },
  bodyHtml: { type: ["string", "null"] }, audioFileId: { type: ["string", "null"] },
  audioDurationSeconds: { type: ["integer", "null"] }, createdAt: { type: "string" },
  author: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } },
} } as const;
const body = { type: "object", additionalProperties: false, properties: {
  body: { type: "string", maxLength: 2000 }, bodyHtml: { type: ["string", "null"], maxLength: 200000 },
  audioFileId: { type: ["string", "null"], pattern: "^[a-zA-Z0-9_-]{1,160}$" },
  audioDurationSeconds: { type: ["integer", "null"], minimum: 1, maximum: MAX_VOICE_NOTE_SECONDS },
  clientMutationId: { type: "string", pattern: "^[a-zA-Z0-9_-]{1,160}$" },
} } as const;

export async function registerUpdateComments(app: FastifyInstance, service: UpdatesService) {
  await app.register(async (routes) => {
    await routes.register(multipart, { limits: { fileSize: MAX_VOICE_NOTE_BYTES, files: 1 } });
    routes.get<{ Params: UpdateCommentParams }>("/projects/:id/updates/:updateId/comments", {
      schema: { params, response: { 200: { type: "array", items: comment } } },
    }, async (request) => {
      await request.requireProjectPermission(request.params.id, "updates", "view");
      return service.listComments(request.params.id, request.params.updateId);
    });
    routes.post<{ Params: UpdateCommentParams; Body: AddCommentInput }>("/projects/:id/updates/:updateId/comments", {
      schema: { params, body, response: { 201: comment } },
    }, async (request, reply) => {
      await request.requireProjectPermission(request.params.id, "updates", "view");
      await request.requireProjectPermission(request.params.id, "comments", "post");
      const user = request.requireAuth();
      const result = await service.addComment(request.params.id, request.params.updateId, request.body, { id: user.id, name: user.name });
      return reply.status(201).send(result);
    });
    routes.post<{ Params: UpdateCommentParams }>("/projects/:id/updates/:updateId/comments/transcribe", {
      schema: { params, response: { 200: { type: "object", properties: { transcript: { type: "string" }, formatted: { type: "string" } } } } },
    }, async (request) => {
      await request.requireProjectPermission(request.params.id, "updates", "view");
      await request.requireProjectPermission(request.params.id, "comments", "post");
      await service.requirePublished(request.params.id, request.params.updateId);
      const part = await request.file();
      if (!part) throw new BadRequestError("Record a voice note first.");
      const bytes = await part.toBuffer();
      return service.transcribeComment(request.params.id, request.params.updateId, new Blob([bytes], { type: part.mimetype }), part.filename || "voice-note.m4a");
    });
  });
}
