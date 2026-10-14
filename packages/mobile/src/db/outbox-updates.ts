import { eq } from "drizzle-orm";
import { File } from "expo-file-system";
import { uploadProjectFile } from "@/api/files";
import { updatesApi, type CreateUpdateMediaInput, type UpdateCategory } from "@/api/updates";
import { API_BASE_URL } from "@/lib/auth-client";
import type { Db } from "./client";
import { done, PermanentOutboxError, skipped, type OutboxHandlerResult } from "./outbox-handler";
import { outbox, type OutboxRow } from "./schema";
import { UPDATES_RESOURCE, updatesRepository } from "./updates-repository";

export { UPDATES_RESOURCE };

/**
 * Uploads an update's attachments and posts the update once there is signal.
 *
 * The bytes go up one file at a time and each resulting url is written back to
 * its own row before the next file starts, so a push that dies on the sixth of
 * ten photos resumes at the sixth instead of re-sending the five that landed.
 * The update itself is posted last, naming the urls — the server will not
 * accept a local path.
 */
export async function pushUpdateOutboxItem(db: Db, item: OutboxRow): Promise<OutboxHandlerResult> {
  if (item.resource !== UPDATES_RESOURCE) return skipped;
  if (item.operation !== "create") {
    throw new PermanentOutboxError(`Updates cannot be "${item.operation}d" from this device.`);
  }

  const row = await updatesRepository.findById(db, item.entityId);
  if (!row) {
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(false);
  }

  const media: CreateUpdateMediaInput[] = [];
  for (const file of await updatesRepository.mediaFor(db, row.id)) {
    const type: CreateUpdateMediaInput["type"] = file.type === "video" ? "video" : "photo";
    if (file.url) {
      media.push({ type, url: file.url });
      continue;
    }
    if (!file.stagedUri || !new File(file.stagedUri).exists) {
      throw new PermanentOutboxError(
        "A photo attached to this update is no longer on this device.",
      );
    }
    const uploaded = await uploadProjectFile(
      item.projectId,
      file.stagedUri,
      file.fileName,
      file.mimeType ?? "application/octet-stream",
    );
    const url = `${API_BASE_URL}/files/${uploaded.id}/view`;
    await updatesRepository.setMediaUrl(db, file.id, url);
    media.push({ type, url });
  }

  const server = await updatesApi.create(item.projectId, {
    category: row.category as UpdateCategory,
    title: row.title,
    description: row.description,
    ...(row.descriptionHtml ? { descriptionHtml: row.descriptionHtml } : {}),
    ...(media.length > 0 ? { media } : {}),
  });

  // swaps the local row for the server's and drops the staged copies
  await updatesRepository.reconcileCreate(db, item.projectId, row.id, server);
  await db.delete(outbox).where(eq(outbox.id, item.id));
  return done(true);
}
