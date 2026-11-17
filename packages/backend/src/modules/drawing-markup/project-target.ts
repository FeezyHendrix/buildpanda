import { NotFoundError } from "../../lib/errors.ts";
import type { DocumentsRepository } from "../documents/repository.ts";
import type { DrawingMarkupRepository } from "./repository.ts";
import type { ProjectDrawingTarget } from "./types.ts";

/** Resolve each drawing and revision inside the project already authorized by the caller. */
export async function requireProjectDrawingTarget(projectId: string, input: ProjectDrawingTarget, markups: DrawingMarkupRepository, documents: DocumentsRepository) {
  let documentId = input.documentId;
  if (input.documentVersionId) {
    const version = await markups.versionById(input.documentVersionId);
    if (!version || (documentId && version.document_id !== documentId)) throw new NotFoundError("Document version");
    documentId = version.document_id;
  }
  if (documentId) {
    const document = await documents.findDocumentById(documentId);
    if (!document || document.project_id !== projectId) throw new NotFoundError("Document");
  }
  if (input.markupId) {
    const markup = await markups.byId(input.markupId);
    if (!markup || markup.project_id !== projectId || markup.deleted_at) throw new NotFoundError("Markup");
  }
}
