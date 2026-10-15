import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { hasRichContent, MAX_VOICE_NOTE_BYTES, voiceNoteError } from "@buildpanda/rich-content";
import type { UpdateComment } from "@/api/updates";
import { features } from "@/lib/feature-access";
import { htmlToText } from "@/lib/html";
import { discardPendingMedia, stagePendingMedia } from "@/lib/pending-media";
import { requireCurrentAccess } from "@/lib/project-access-store";
import type { Db } from "./client";
import { repositoryAccess } from "./permissions";
import { outbox, projectUpdates, updateComments, type UpdateCommentRow } from "./schema";

const access = repositoryAccess(features.updates);
export const UPDATE_COMMENTS_RESOURCE = "update-comments";
export interface NewLocalUpdateComment {
  bodyHtml: string;
  authorName: string;
  audio?: { uri: string; durationSeconds: number; mimeType: string } | null;
}

function serverValues(projectId: string, row: UpdateComment) {
  return { id: row.id, projectId, updateId: row.updateId, authorId: row.author.id, authorName: row.author.name,
    body: row.body, bodyHtml: row.bodyHtml ?? null, audioFileId: row.audioFileId ?? null,
    audioDurationSeconds: row.audioDurationSeconds ?? null, createdAt: row.createdAt, isPendingSync: false };
}
function parentWhere(db: Db, projectId: string) {
  return inArray(updateComments.updateId, db.select({ id: projectUpdates.id }).from(projectUpdates)
    .where(access.where(db, projectUpdates.projectId, eq(projectUpdates.projectId, projectId))));
}

export const updateCommentsRepository = {
  listQuery(db: Db, projectId: string, updateId: string) {
    return db.select().from(updateComments).where(access.where(db, updateComments.projectId,
      eq(updateComments.projectId, projectId), eq(updateComments.updateId, updateId), parentWhere(db, projectId))).orderBy(asc(updateComments.createdAt));
  },
  find(db: Db, projectId: string, id: string): UpdateCommentRow | undefined {
    return db.select().from(updateComments).where(access.where(db, updateComments.projectId,
      eq(updateComments.projectId, projectId), eq(updateComments.id, id), parentWhere(db, projectId))).get();
  },
  async addLocal(db: Db, projectId: string, updateId: string, input: NewLocalUpdateComment): Promise<void> {
    const ticket = access.require(db, projectId, "comment");
    access.record(db, projectUpdates, updateId, projectId);
    const body = htmlToText(input.bodyHtml);
    if (!hasRichContent(input.bodyHtml) && !input.audio) throw new Error("Add a comment, image or voice note.");
    if (body.length > 2000) throw new Error("Comments can contain up to 2,000 characters.");
    if (input.audio) {
      const error = voiceNoteError(input.audio.mimeType, 1, input.audio.durationSeconds);
      if (error) throw new Error(error);
    }
    const id = `local_${randomUUID()}`;
    let stagedAudioUri: string | null = null;
    try {
      if (input.audio) stagedAudioUri = await stagePendingMedia(ticket.scope, input.audio.uri, id,
        input.audio.mimeType === "audio/webm" ? "voice-note.webm" : "voice-note.m4a", MAX_VOICE_NOTE_BYTES);
      requireCurrentAccess(ticket);
      access.transaction(db, projectId, "comment", (tx) => {
        access.record(db, projectUpdates, updateId, projectId);
        tx.insert(updateComments).values({ id, projectId, updateId, body, bodyHtml: input.bodyHtml || null,
          authorId: ticket.scope.userId, authorName: input.authorName, stagedAudioUri,
          audioDurationSeconds: input.audio?.durationSeconds ?? null, audioMimeType: input.audio?.mimeType ?? null,
          createdAt: new Date().toISOString(), isPendingSync: true }).run();
        tx.insert(outbox).values({ id: randomUUID(), projectId, entityId: id, resource: UPDATE_COMMENTS_RESOURCE, operation: "create", nextAttemptAt: 0 }).run();
      });
    } catch (error) { await discardPendingMedia(stagedAudioUri); throw error; }
  },
  setAudioFile(db: Db, projectId: string, id: string, fileId: string) {
    access.transaction(db, projectId, "comment", (tx) => tx.update(updateComments).set({ audioFileId: fileId })
      .where(access.where(db, updateComments.projectId, eq(updateComments.id, id), parentWhere(db, projectId))).run());
  },
  replaceFromServer(db: Db, projectId: string, updateId: string, rows: readonly UpdateComment[]) {
    access.record(db, projectUpdates, updateId, projectId);
    if (rows.some((row) => row.updateId !== updateId)) throw new Error("Comment belongs to another update.");
    access.transaction(db, projectId, "read", (tx) => {
      tx.delete(updateComments).where(and(eq(updateComments.projectId, projectId), eq(updateComments.updateId, updateId),
        eq(updateComments.isPendingSync, false), rows.length ? notInArray(updateComments.id, rows.map((row) => row.id)) : undefined)).run();
      for (const row of rows) tx.insert(updateComments).values(serverValues(projectId, row)).onConflictDoUpdate({ target: updateComments.id,
        set: serverValues(projectId, row), where: eq(updateComments.isPendingSync, false) }).run();
    });
  },
  async reconcile(db: Db, projectId: string, local: UpdateCommentRow, server: UpdateComment) {
    if (server.updateId !== local.updateId) throw new Error("Comment belongs to another update.");
    access.transaction(db, projectId, "read", (tx) => {
      tx.delete(updateComments).where(and(eq(updateComments.projectId, projectId), eq(updateComments.id, local.id))).run();
      tx.insert(updateComments).values(serverValues(projectId, server)).onConflictDoNothing().run();
    });
    await discardPendingMedia(local.stagedAudioUri);
  },
};
