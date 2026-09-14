import { eq } from "drizzle-orm";
import { File } from "expo-file-system";
import { documentsApi } from "@/api/documents";
import { uploadProjectFile } from "@/api/files";
import type { Db } from "./client";
import { DOCUMENTS_RESOURCE, documentsRepository } from "./documents-repository";
import { done, PermanentOutboxError, skipped, type OutboxHandlerResult } from "./outbox-handler";
import { outbox, type OutboxRow } from "./schema";

export { DOCUMENTS_RESOURCE };

/**
 * Uploads a staged file and files the document once there is signal.
 *
 * Two calls, the same as the web: the bytes go up first, then the document
 * record points at them. If the second call fails the row is retried whole,
 * which re-sends the bytes; the server keeps the orphaned file and nothing on
 * site is lost, which is the right side to err on.
 */
export async function pushDocumentOutboxItem(db: Db, item: OutboxRow): Promise<OutboxHandlerResult> {
  if (item.resource !== DOCUMENTS_RESOURCE) return skipped;
  if (item.operation !== "create") {
    throw new PermanentOutboxError(`Documents cannot be "${item.operation}d" from this device.`);
  }

  const row = await documentsRepository.findById(db, item.entityId);
  if (!row) {
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(false);
  }
  if (!row.categoryId) throw new PermanentOutboxError("This file was queued without a category.");
  if (!row.stagedUri || !new File(row.stagedUri).exists) {
    throw new PermanentOutboxError("The file picked for upload is no longer on this device.");
  }

  const uploaded = await uploadProjectFile(
    item.projectId,
    row.stagedUri,
    row.fileName,
    row.mimeType ?? "application/octet-stream",
  );
  const server = await documentsApi.createDocument(item.projectId, {
    categoryId: row.categoryId,
    fileId: uploaded.id,
  });
  // swaps the local row for the server's and drops the staged copy
  await documentsRepository.reconcileCreate(db, item.projectId, row.id, server);
  await db.delete(outbox).where(eq(outbox.id, item.id));
  return done(true);
}
