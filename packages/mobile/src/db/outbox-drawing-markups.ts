import { eq } from "drizzle-orm";
import { drawingMarkupApi } from "@/api/drawing-markup";
import { uploadProjectFile } from "@/api/files";
import type { MarkupGeometry } from "@/components/plan-review/markup-types";
import type { Db } from "./client";
import { drawingMarkupsRepository } from "./drawing-markups-repository";
import { done, PermanentOutboxError, skipped, type OutboxHandlerResult } from "./outbox-handler";
import { drawingMarkups, outbox, type OutboxRow } from "./schema";

export async function pushDrawingMarkupOutboxItem(db: Db, item: OutboxRow): Promise<OutboxHandlerResult> {
  if (item.resource !== "drawing-markups") return skipped;

  if (item.operation === "delete") {
    await drawingMarkupApi.remove(item.projectId, item.entityId);
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(true);
  }

  const row = await drawingMarkupsRepository.findById(db, item.entityId);
  if (!row) {
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(false);
  }

  if (item.operation === "resolve") {
    // the row's current state is what is sent, so resolve-then-reopen before a flush sends once
    await drawingMarkupApi.setResolved(item.projectId, row.id, row.resolvedAt !== null);
    await db
      .update(drawingMarkups)
      .set({ isPendingSync: false, updatedAt: Date.now() })
      .where(eq(drawingMarkups.id, row.id));
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(true);
  }

  if (item.operation !== "create") {
    throw new PermanentOutboxError(`Markups cannot be "${item.operation}d" from this device.`);
  }

  const server = await drawingMarkupApi.create(item.projectId, {
    documentId: row.documentId,
    documentVersionId: row.documentVersionId,
    pageNo: row.pageNo,
    kind: row.kind as never,
    geometry: JSON.parse(row.geometry) as MarkupGeometry,
    color: row.color,
  });
  // this also moves any comment queued against the local id, in one transaction
  await drawingMarkupsRepository.reconcileCreate(db, row.id, server.id);
  await db.delete(outbox).where(eq(outbox.id, item.id));
  return done(true);
}

/**
 * A comment, and the voice or video note that came with it.
 *
 * The media was staged on disk when the crew member recorded it, so the upload
 * happens here, when there is signal, rather than being required at the moment
 * they spoke. A comment whose markup has not been pushed yet waits: its parent
 * carries the newer id.
 */
export async function pushDrawingMarkupCommentOutboxItem(db: Db, item: OutboxRow): Promise<OutboxHandlerResult> {
  if (item.resource !== "drawing-markup-comments") return skipped;

  const comment = await drawingMarkupsRepository.commentById(db, item.entityId);
  if (!comment) {
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(false);
  }
  if (comment.markupId.startsWith("local_")) return done(false);

  let fileId: string | null = null;
  if (comment.stagedMediaUri && comment.mediaKind) {
    const name = comment.mediaKind === "audio" ? "voice-note.m4a" : "site-video.mov";
    const mime = comment.mediaKind === "audio" ? "audio/m4a" : "video/quicktime";
    fileId = (await uploadProjectFile(item.projectId, comment.stagedMediaUri, name, mime)).id;
  }

  await drawingMarkupApi.addComment(item.projectId, comment.markupId, {
    body: comment.body,
    mediaKind: comment.mediaKind as never,
    fileId,
    mediaDurationSeconds: comment.mediaDurationSeconds,
    assigneeId: comment.assigneeId,
  });
  await drawingMarkupsRepository.markCommentSynced(db, comment.id, comment.stagedMediaUri);
  await db.delete(outbox).where(eq(outbox.id, item.id));
  return done(true);
}
