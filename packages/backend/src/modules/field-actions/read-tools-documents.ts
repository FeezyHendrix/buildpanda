import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { documentsRepository } from "../documents/repository.ts";
import { documentsService } from "../documents/service.ts";
import { filesRepository } from "../files/repository.ts";
import { drawingMarkupRepository } from "../drawing-markup/repository.ts";
import { drawingMarkupService } from "../drawing-markup/service.ts";
import { requireProjectDrawingTarget } from "../drawing-markup/project-target.ts";
import { readTool, targetFields, idField, textArg } from "./read-tools-support.ts";

export function documentReadTools() {
  return [
    readTool("read_document", "Read the document/drawing register or one document with all revisions and current-version metadata. Actual file viewing/download is a separate authorized action.", {
      ...targetFields, view: { type: "string", enum: ["register", "categories"] },
    }, async (context, args) => {
      const service = documentsService(documentsRepository(context.db), filesRepository(context.db));
      if (args.view === "categories") return service.categoriesForProject(context.project.id);
      const documents = await service.listByProject(context.project.id);
      const id = textArg(args, "targetId");
      if (!id) return documents;
      const document = documents.find((record) => record.id === id);
      if (!document) throw new NotFoundError("Document");
      return { document, versions: await service.listVersions(context.project.id, id) };
    }),
    readTool("read_drawing", "Read persisted drawing pins, pen/cloud/measurement geometry, resolved state, anchored revision, comments and media metadata. Supply documentId, documentVersionId or targetId (markup ID).", {
      ...targetFields, documentId: idField, documentVersionId: idField, pageNo: { type: "integer", minimum: 1 },
    }, async (context, args) => {
      const documentId = textArg(args, "documentId"), documentVersionId = textArg(args, "documentVersionId"), markupId = textArg(args, "targetId");
      if (!documentId && !documentVersionId && !markupId) throw new BadRequestError("Choose a drawing, revision or annotation to read.");
      const repository = drawingMarkupRepository(context.db);
      await requireProjectDrawingTarget(context.project.id, { documentId, documentVersionId, markupId }, repository, documentsRepository(context.db));
      const service = drawingMarkupService(repository);
      if (markupId) {
        const markup = await service.get(markupId);
        if ((documentId && markup.documentId !== documentId) || (documentVersionId && markup.documentVersionId !== documentVersionId)) throw new NotFoundError("Markup on selected drawing revision");
        return markup;
      }
      return documentVersionId ? service.listForVersion(documentVersionId, args.pageNo as number | undefined) : service.listForDocument(documentId!);
    }),
  ];
}
