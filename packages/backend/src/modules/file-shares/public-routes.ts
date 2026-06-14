import type { FastifyPluginAsync } from "fastify";
import { NotFoundError } from "../../lib/errors.ts";
import { openStoredFile } from "../../lib/file-storage.ts";
import { fileSharesRepository, type ShareFileInfo } from "./repository.ts";

const tokenParams = {
  type: "object",
  properties: { token: { type: "string", minLength: 1 } },
  required: ["token"],
  additionalProperties: false,
} as const;

function isUnavailable(share: ShareFileInfo): boolean {
  if (share.revokedAt) return true;
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) return true;
  return false;
}

const publicFileShareRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = fileSharesRepository(fastify.db);

  fastify.get<{ Params: { token: string } }>(
    "/share/:token",
    { schema: { params: tokenParams } },
    async (request) => {
      const share = await repo.byToken(request.params.token);
      if (!share) throw new NotFoundError("Shared file");
      if (isUnavailable(share)) {
        return { available: false, fileName: share.fileName, projectName: share.projectName };
      }
      await repo.incrementView(request.params.token);
      return {
        available: true,
        fileName: share.fileName,
        projectName: share.projectName,
        mimeType: share.mimeType,
        expiresAt: share.expiresAt,
        fileUrl: `/share/${request.params.token}/file`,
      };
    },
  );

  fastify.get<{ Params: { token: string } }>(
    "/share/:token/file",
    { schema: { params: tokenParams } },
    async (request, reply) => {
      const share = await repo.byToken(request.params.token);
      if (!share || isUnavailable(share) || !share.storagePath) {
        throw new NotFoundError("Shared file");
      }
      const stream = await openStoredFile(share.storagePath);
      reply.header("Content-Type", share.mimeType ?? "application/octet-stream");
      reply.header("Content-Disposition", `inline; filename="${share.fileName.replace(/"/g, "")}"`);
      reply.header("Cache-Control", "private, max-age=0, must-revalidate");
      return reply.send(stream);
    },
  );
};

export default publicFileShareRoutes;
