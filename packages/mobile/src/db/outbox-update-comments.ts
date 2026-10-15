import { updatesApi } from "@/api/updates";
import { uploadProjectFile } from "@/api/files";
import { features } from "@/lib/feature-access";
import { loadPendingMedia } from "@/lib/pending-media";
import { requireCurrentAccess } from "@/lib/project-access-store";
import type { Db } from "./client";
import { requireOutboxAccess } from "./outbox-access";
import { done, dropItem, finishItem, PermanentOutboxError, skipped } from "./outbox-handler";
import type { OutboxRow } from "./schema";
import { UPDATE_COMMENTS_RESOURCE, updateCommentsRepository } from "./update-comments-repository";

export async function pushUpdateCommentOutboxItem(db: Db, item: OutboxRow) {
  if (item.resource !== UPDATE_COMMENTS_RESOURCE) return skipped;
  if (item.operation !== "create") throw new PermanentOutboxError("Comments are append-only.");
  const ticket = requireOutboxAccess(db, item);
  const row = updateCommentsRepository.find(db, item.projectId, item.entityId);
  if (!row) return dropItem(db, item);
  if (row.updateId.startsWith("local_")) return done(false);
  let audioFileId = row.audioFileId;
  if (row.stagedAudioUri && !audioFileId) {
    const uri = await loadPendingMedia(row.stagedAudioUri);
    requireCurrentAccess(ticket);
    const uploaded = await uploadProjectFile(item.projectId, uri,
      row.audioMimeType === "audio/webm" ? "voice-note.webm" : "voice-note.m4a", row.audioMimeType ?? "audio/m4a", features.updates.actions.comment);
    requireCurrentAccess(ticket);
    audioFileId = uploaded.id;
    updateCommentsRepository.setAudioFile(db, item.projectId, row.id, audioFileId);
  }
  const server = await updatesApi.comment(item.projectId, row.updateId, { body: row.body, bodyHtml: row.bodyHtml,
    audioFileId, audioDurationSeconds: row.audioDurationSeconds, clientMutationId: row.id });
  requireCurrentAccess(ticket);
  await updateCommentsRepository.reconcile(db, item.projectId, row, server);
  return finishItem(db, item);
}
