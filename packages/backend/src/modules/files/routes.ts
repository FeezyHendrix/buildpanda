import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { config } from "../../config/index.ts";
import { BadRequestError } from "../../lib/errors.ts";
import { filesRepository } from "./repository.ts";
import { filesService } from "./service.ts";

const fileIdParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

const fileRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: {
      fileSize: config.uploads.maxFileBytes,
      files: 5,
    },
  });

  const service = filesService(filesRepository(fastify.db));

  fastify.post("/files", async (request, reply) => {
    const user = request.requireAuth();
    const part = await request.file();
    if (!part) throw new BadRequestError("Missing file upload");

    const uploaded = await service.upload(user.id, {
      fileName: part.filename,
      mimeType: part.mimetype,
      data: part.file,
    });
    return reply.status(201).send(uploaded);
  });

  fastify.get<{ Params: { id: string } }>(
    "/files/:id",
    { schema: { params: fileIdParams } },
    async (request) => {
      const user = request.requireAuth();
      return service.getMetadata(user.id, request.params.id);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/files/:id/download",
    { schema: { params: fileIdParams } },
    async (request, reply) => {
      const user = request.requireAuth();
      const handle = await service.download(user.id, request.params.id);
      reply.header("Content-Type", handle.mimeType);
      reply.header("Content-Length", handle.sizeBytes);
      reply.header(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(handle.fileName)}"`,
      );
      return reply.send(handle.stream);
    },
  );
};

export default fileRoutes;
