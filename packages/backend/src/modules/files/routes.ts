import type { FastifyPluginAsync, FastifyRequest } from "fastify";
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

  // Same access rule as /files/:id/url: project-linked files are readable by
  // anyone with project access (update photos are viewed by the whole project
  // team, not just the uploader); unlinked files stay owner-only.
  async function authorizeRead(request: FastifyRequest<{ Params: { id: string } }>) {
    const user = request.requireAuth();
    const row = await service.findRow(request.params.id);
    if (!row) throw new NotFoundError("File");
    if (row.project_id) {
      await request.requireProjectAccess(row.project_id);
    } else if (row.owner_id !== user.id) {
      throw new ForbiddenError();
    }
    return row;
  }

  // Both of these redirect to a short-lived presigned URL rather than piping the
  // bytes through Fastify. Streaming them here answered every request with a
  // whole-file 200 — no Accept-Ranges, no 206 — so a <video> could not seek and
  // in most browsers would not play at all. Object storage handles Range natively.
  fastify.get<{ Params: { id: string } }>(
    "/files/:id/view",
    { schema: { params: fileIdParams } },
    async (request, reply) => {
      const row = await authorizeRead(request);
      return reply.redirect(await service.presignViewUrl(row, "inline"), 302);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/files/:id/download",
    { schema: { params: fileIdParams } },
    async (request, reply) => {
      const row = await authorizeRead(request);
      return reply.redirect(await service.presignViewUrl(row, "attachment"), 302);
    },
  );
};

export default fileRoutes;
