import { drawingMarkupRepository } from "../drawing-markup/repository.ts";
import { drawingMarkupService } from "../drawing-markup/service.ts";
import { requireProjectDrawingTarget } from "../drawing-markup/project-target.ts";
import { documentsRepository } from "../documents/repository.ts";
import { collaborationFiles } from "./collaboration-files.ts";
import { collaborationSchemas } from "./collaboration-schemas.ts";
import type { CollaborationPayloads } from "./collaboration-types.ts";
import { validateFieldPayload } from "./tool-schema.ts";
import { drawingFollowUp, requireDrawingFollowUp } from "./collaboration-follow-up.ts";
import type { FieldToolHandler } from "./tool-types.ts";

const drawing: FieldToolHandler = async (input, context) => {
  await context.requireFeature("projects.documents");
  const kind = input.kind as "annotate_drawing" | "comment_drawing" | "resolve_drawing" | "delete_drawing";
  const payload = validateFieldPayload<CollaborationPayloads[typeof kind]>(collaborationSchemas[kind], input.payload);
  await context.request.requireProjectPermission(input.projectId, "documents", "view");
  await context.request.requireProjectPermission(input.projectId, "documents", "markup");
  const repository = drawingMarkupRepository(context.db);
  await requireProjectDrawingTarget(input.projectId, payload, repository, documentsRepository(context.db));
  await collaborationFiles(context, payload);
  const service = drawingMarkupService(repository);
  if (kind === "annotate_drawing") {
    const { comment, followUp, ...body } = payload as CollaborationPayloads["annotate_drawing"];
    await requireDrawingFollowUp(followUp, body, context);
    const record = await service.create(input.projectId, context.user.id, body);
    if (comment) await service.addComment(record.id, context.user.id, comment);
    const related = await drawingFollowUp(input, followUp, record, context);
    return { kind, projectId: input.projectId, recordId: record.id, message: related ? `Annotation and linked ${related.kind === "rfi" ? "RFI" : "material approval"} created.` : "Annotation added to the selected drawing revision.", data: {
      documentVersionId: record.documentVersionId, pageNo: record.pageNo,
      ...(related ? { relatedRecordId: related.recordId, relatedKind: related.kind } : {}),
    } };
  }
  const { markupId, ...body } = payload as CollaborationPayloads["comment_drawing"] & CollaborationPayloads["resolve_drawing"];
  if (kind === "comment_drawing") {
    const record = await service.addComment(markupId, context.user.id, body);
    return { kind, projectId: input.projectId, recordId: record.id, message: "Drawing comment added.", data: { markupId } };
  }
  if (kind === "resolve_drawing") {
    const record = await service.setResolved(markupId, context.user.id, body.resolved);
    return { kind, projectId: input.projectId, recordId: record.id, message: body.resolved ? "Drawing annotation resolved." : "Drawing annotation reopened.", data: { documentVersionId: record.documentVersionId } };
  }
  await service.remove(markupId);
  return { kind, projectId: input.projectId, recordId: markupId, message: "Drawing annotation deleted." };
};

export const collaborationDrawingHandlers = { annotate_drawing: drawing, comment_drawing: drawing, resolve_drawing: drawing, delete_drawing: drawing } satisfies Record<string, FieldToolHandler>;
