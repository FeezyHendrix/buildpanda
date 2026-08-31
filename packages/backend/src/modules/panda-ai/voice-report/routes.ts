import multipart from "@fastify/multipart";
import type { FastifyPluginAsync } from "fastify";
import { config } from "../../../config/index.ts";
import { BadRequestError } from "../../../lib/errors.ts";
import { voiceReportRepository } from "./repository.ts";
import { transcribeAndClassify } from "./service.ts";

const projectIdParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

const voiceReportRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: { fileSize: config.uploads.maxFileBytes, files: 1 },
  });

  const repository = voiceReportRepository(fastify.db);

  // No `response` schema: the body is model-drafted JSON, not DB rows, so there
  // is no column to allowlist — the shape is already guaranteed by the zod
  // validation in the service.
  fastify.post<{ Params: { id: string } }>(
    "/projects/:id/ai/voice-report",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "project", "view");

      const part = await request.file();
      if (!part) throw new BadRequestError("Missing audio upload");

      const buffer = await part.toBuffer();
      const audio = new Blob([buffer], { type: part.mimetype || "audio/m4a" });
      const snapshot = await repository.snapshot(project.id);
      return transcribeAndClassify(audio, part.filename || "field-note.m4a", snapshot);
    },
  );
};

export default voiceReportRoutes;
