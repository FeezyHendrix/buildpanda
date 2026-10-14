import type { FastifyInstance } from "fastify";
import { NotFoundError } from "../../lib/errors.ts";
import { documentsRepository } from "../documents/repository.ts";
import { filesRepository } from "../files/repository.ts";
import { filesService } from "../files/service.ts";
import { fileAccessRepository } from "../files/access-repository.ts";
import { requireFileAttachment } from "../files/access.ts";
import { drawingMarkupRepository } from "./repository.ts";

/** Resolve every referenced record inside the project authorized by the URL. */
export function registerProjectMarkupAccess(app: FastifyInstance) {
  const documents = documentsRepository(app.db);
  const markups = drawingMarkupRepository(app.db);
  const files = filesService(filesRepository(app.db));
  const fileAccess = fileAccessRepository(app.db);
  app.addHook("preHandler", async (request) => {
    if (!request.routeOptions.url?.startsWith("/projects/:id/")) return;
    const params = request.params as { id: string; documentId?: string; markupId?: string };
    await request.requireProjectPermission(params.id, "documents", "view");
    if (request.method !== "GET") await request.requireProjectPermission(params.id, "documents", "markup");
    const input = request.body as { documentId?: string; documentVersionId?: string; fileId?: string } | undefined;
    const versionId = input?.documentVersionId ?? (request.query as { documentVersionId?: string }).documentVersionId;
    let documentId = params.documentId ?? input?.documentId;
    if (versionId) {
      const version = await markups.versionById(versionId);
      if (!version || (documentId && version.document_id !== documentId)) throw new NotFoundError("Document version");
      documentId = version.document_id;
    }
    if (documentId) {
      const document = await documents.findDocumentById(documentId);
      if (!document || document.project_id !== params.id) throw new NotFoundError("Document");
    }
    if (params.markupId) {
      const markup = await markups.byId(params.markupId);
      if (!markup || markup.project_id !== params.id) throw new NotFoundError("Markup");
    }
    await requireFileAttachment(request, params.id, input?.fileId, files, fileAccess);
  });
}
