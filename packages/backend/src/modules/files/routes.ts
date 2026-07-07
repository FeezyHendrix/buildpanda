import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { config } from "../../config/index.ts";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../lib/errors.ts";
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

    const projectField = part.fields.projectId;
    const projectId =
      projectField && !Array.isArray(projectField) && projectField.type === "field"
        ? String(projectField.value) || null
        : null;
    // Associating a file with a project both records ownership for later
    // access checks and asserts the uploader may write to that project.
    if (projectId) await request.requireProjectWrite(projectId);

    const uploaded = await service.upload(user.id, {
      fileName: part.filename,
      mimeType: part.mimetype,
      projectId,
      data: part.file,
    });
    return reply.status(201).send(uploaded);
  });

  fastify.get<{ Params: { id: string } }>(
    "/files/:id/url",
    { schema: { params: fileIdParams } },
    async (request) => {
      const user = request.requireAuth();
      const row = await service.findRow(request.params.id);
      if (!row) throw new NotFoundError("File");
      if (row.project_id) {
        await request.requireProjectAccess(row.project_id);
      } else if (row.owner_id !== user.id) {
        throw new ForbiddenError();
      }
      const url = await service.presignViewUrl(row);
      return { url };
    },
  );

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
      // Same access rule as /files/:id/url: project-linked files are readable
      // by anyone with project access (update photos are viewed by the whole
      // project team, not just the uploader); unlinked files stay owner-only.
      const row = await service.findRow(request.params.id);
      if (!row) throw new NotFoundError("File");
      if (row.project_id) {
        await request.requireProjectAccess(row.project_id);
      } else if (row.owner_id !== user.id) {
        throw new ForbiddenError();
      }
      const handle = await service.open(row);
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
