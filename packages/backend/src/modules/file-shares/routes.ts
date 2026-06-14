import type { FastifyPluginAsync } from "fastify";
import { generateId } from "../../lib/ids.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { config } from "../../config/index.ts";
import { fileSharesRepository, type FileShareRow } from "./repository.ts";

const docParams = {
  type: "object",
  required: ["id", "documentId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    documentId: { type: "string", minLength: 1 },
  },
} as const;

const shareParams = {
  type: "object",
  required: ["id", "shareId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    shareId: { type: "string", minLength: 1 },
  },
} as const;

const createBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    expiresInDays: { type: "number", minimum: 1, maximum: 365 },
  },
} as const;

const DEFAULT_EXPIRY_DAYS = 30;

function shareUrl(token: string): string {
  const base = config.mail.appUrl.replace(/\/$/, "");
  return `${base}/share/${token}`;
}

function toDto(row: FileShareRow) {
  return {
    id: row.id,
    token: row.token,
    url: shareUrl(row.token),
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    viewCount: row.view_count,
    createdAt: row.created_at,
  };
}

const fileSharesRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = fileSharesRepository(fastify.db);

  async function assertDocument(projectId: string, documentId: string): Promise<void> {
    const doc = await fastify.db("project_documents")
      .where({ id: documentId, project_id: projectId })
      .first<{ id: string }>("id");
    if (!doc) throw new NotFoundError("Document");
  }

  fastify.post<{ Params: { id: string; documentId: string }; Body: { expiresInDays?: number } }>(
    "/projects/:id/documents/:documentId/share",
    { schema: { params: docParams, body: createBody } },
    async (request, reply) => {
      await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      await assertDocument(request.params.id, request.params.documentId);

      const existing = await repo.existingForDocument(request.params.documentId);
      if (existing && (!existing.expires_at || new Date(existing.expires_at) > new Date())) {
        return reply.status(200).send(toDto(existing));
      }

      const days = request.body.expiresInDays ?? DEFAULT_EXPIRY_DAYS;
      const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
      const share = await repo.create({
        id: generateId("share"),
        project_id: request.params.id,
        document_id: request.params.documentId,
        token: generateId("sh").replace(/^sh_/, ""),
        created_by: user.id,
        expires_at: expiresAt,
      });
      return reply.status(201).send(toDto(share));
    },
  );

  fastify.get<{ Params: { id: string; documentId: string } }>(
    "/projects/:id/documents/:documentId/shares",
    { schema: { params: docParams } },
    async (request) => {
      await request.requireProjectAccess(request.params.id);
      const shares = await repo.listForDocument(request.params.documentId);
      return shares.map(toDto);
    },
  );

  fastify.delete<{ Params: { id: string; shareId: string } }>(
    "/projects/:id/shares/:shareId",
    { schema: { params: shareParams } },
    async (request, reply) => {
      await request.requireProjectWrite(request.params.id);
      const share = await repo.findById(request.params.shareId, request.params.id);
      if (!share) throw new NotFoundError("Share");
      await repo.revoke(request.params.shareId, request.params.id);
      return reply.status(204).send();
    },
  );
};

export default fileSharesRoutes;
