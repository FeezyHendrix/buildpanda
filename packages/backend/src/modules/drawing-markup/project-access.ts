import type { FastifyInstance } from "fastify";
import { documentsRepository } from "../documents/repository.ts";
import { filesRepository } from "../files/repository.ts";
import { filesService } from "../files/service.ts";
import { fileAccessRepository } from "../files/access-repository.ts";
import { requireFileAttachment } from "../files/access.ts";
import { drawingMarkupRepository } from "./repository.ts";
import { requireProjectDrawingTarget } from "./project-target.ts";

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
    await requireProjectDrawingTarget(params.id, { documentId: params.documentId ?? input?.documentId, documentVersionId: versionId, markupId: params.markupId }, markups, documents);
    await requireFileAttachment(request, params.id, input?.fileId, files, fileAccess);
  });
}
