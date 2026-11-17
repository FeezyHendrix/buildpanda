import { NotFoundError } from "../../lib/errors.ts";
import { documentsRepository } from "../documents/repository.ts";
import { documentsService } from "../documents/service.ts";
import { documentNotificationAccess } from "../documents/notification-access.ts";
import { filesRepository } from "../files/repository.ts";
import { collaborationFiles } from "./collaboration-files.ts";
import { collaborationNotifications } from "./collaboration-notifications.ts";
import { collaborationSchemas } from "./collaboration-schemas.ts";
import type { CollaborationPayloads } from "./collaboration-types.ts";
import { validateFieldPayload } from "./tool-schema.ts";
import type { FieldToolHandler } from "./tool-types.ts";

const document: FieldToolHandler = async (input, context) => {
  await context.requireFeature("projects.documents");
  const kind = input.kind as "upload_document" | "rename_document" | "upload_document_version" | "download_document" | "open_document" | "delete_document";
  const payload = validateFieldPayload<CollaborationPayloads[typeof kind]>(collaborationSchemas[kind], input.payload);
  const read = kind === "download_document" || kind === "open_document";
  await context.request.requireProjectPermission(input.projectId, "documents", read ? "view" : kind === "delete_document" ? "delete" : "upload");
  await collaborationFiles(context, payload);
  const fanout = collaborationNotifications(context);
  const service = documentsService(documentsRepository(context.db), filesRepository(context.db), { notifications: fanout.notifications, notificationRecipients: documentNotificationAccess(context.db) });
  if (kind === "upload_document") {
    const created = await service.create(input.projectId, payload as CollaborationPayloads["upload_document"], context.user.id);
    await fanout.flush();
    return { kind, projectId: input.projectId, recordId: created.id, message: "Document registered with its uploaded file.", data: { versionId: created.currentVersionId } };
  }
  const { documentId, ...body } = payload as CollaborationPayloads["rename_document"] & CollaborationPayloads["upload_document_version"] & CollaborationPayloads["open_document"];
  if (kind === "rename_document") {
    const record = await service.edit(input.projectId, documentId, body);
    return { kind, projectId: input.projectId, recordId: record.id, message: "Document updated." };
  }
  if (kind === "upload_document_version") {
    const record = await service.addVersion(input.projectId, documentId, body, context.user.id);
    return { kind, projectId: input.projectId, recordId: record.id, message: "Document revision added.", data: { documentId, versionNo: record.versionNo } };
  }
  if (kind === "delete_document") {
    await service.remove(input.projectId, documentId);
    return { kind, projectId: input.projectId, recordId: documentId, message: "Document deleted." };
  }
  const versions = await service.listVersions(input.projectId, documentId);
  const version = body.versionId ? versions.find((item) => item.id === body.versionId) : versions.find((item) => item.isCurrent);
  if (!version) throw new NotFoundError("Document revision with a downloadable file");
  const file = await service.resolveVersionFile(input.projectId, documentId, version.id);
  const url = `/api/projects/${encodeURIComponent(input.projectId)}/documents/${encodeURIComponent(documentId)}/versions/${encodeURIComponent(version.id)}/view`;
  return { kind, projectId: input.projectId, recordId: documentId, message: "Document revision is ready to view or download in BuildPanda.", data: {
    documentId, versionId: version.id, versionNo: version.versionNo, fileName: file.fileName, mimeType: file.mimeType, url, requiresAuthentication: true,
  } };
};

export const collaborationDocumentHandlers = {
  upload_document: document, rename_document: document, upload_document_version: document,
  download_document: document, open_document: document, delete_document: document,
} satisfies Record<string, FieldToolHandler>;
