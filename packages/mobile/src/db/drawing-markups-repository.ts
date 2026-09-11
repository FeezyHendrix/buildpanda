import { randomUUID } from "expo-crypto";
import { discardStagedMedia } from "@/lib/stage-media";
import { and, eq, inArray } from "drizzle-orm";
import type { DrawingMarkup, DrawingMarkupComment, MarkupKind } from "@/api/drawing-markup";
import type { MarkupGeometry } from "@/components/plan-review/markup-types";
import { palette } from "@/constants/colors";
import type { Db } from "./client";
import { enqueueDelete, reviveOrQueue } from "./enqueue-update";
import {
  drawingMarkupComments,
  drawingMarkups,
  materialApprovals,
  outbox,
  rfis,
  type DrawingMarkupCommentRow,
  type DrawingMarkupRow,
} from "./schema";

// Markups drawn on site are written here first and pushed by the outbox, so a
// redline survives a basement with no signal. Geometry is stored as the JSON
// the canvas produced, because only the canvas and the server read it.

const RESOURCE = "drawing-markups";
const COMMENT_RESOURCE = "drawing-markup-comments";

export interface LocalMarkupInput {
  projectId: string;
  documentId: string;
  documentVersionId: string;
  pageNo: number;
  kind: string;
  geometry: MarkupGeometry;
  color?: string;
}

function parseGeometry(raw: string): MarkupGeometry | null {
  try {
    return JSON.parse(raw) as MarkupGeometry;
  } catch {
    return null;
  }
}

/**
 * A local row in the shape the screen already renders. A markup that has not
 * reached the server yet has no author, no revision label and no comments;
 * those arrive with the server's copy when the push lands.
 */
export function toMarkup(row: DrawingMarkupRow): (DrawingMarkup & { isPendingSync: boolean }) | null {
  const geometry = parseGeometry(row.geometry);
  if (!geometry) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    documentId: row.documentId,
    documentVersionId: row.documentVersionId,
    revisionLabel: null,
    isCurrentRevision: true,
    pageNo: row.pageNo,
    kind: row.kind as MarkupKind,
    geometry,
    color: row.color,
    authorId: null,
    authorName: null,
    resolvedAt: row.resolvedAt,
    createdAt: new Date(row.updatedAt).toISOString(),
    comments: [],
    linkedRfiId: null,
    linkedApprovalId: null,
    isPendingSync: row.isPendingSync,
  };
}

/** A local comment in the shape the panel renders. */
export function toComment(row: DrawingMarkupCommentRow): DrawingMarkupComment & { isPendingSync: boolean } {
  return {
    id: row.id,
    markupId: row.markupId,
    body: row.body,
    bodyHtml: null,
    mediaKind: (row.mediaKind ?? null) as DrawingMarkupComment["mediaKind"],
    // a note that has not been uploaded has no file id yet; the staged copy is what exists
    fileId: null,
    mediaDurationSeconds: row.mediaDurationSeconds,
    assigneeId: row.assigneeId,
    assigneeName: null,
    authorId: null,
    authorName: row.authorName || null,
    createdAt: new Date(row.createdAt).toISOString(),
    isPendingSync: row.isPendingSync,
  };
}

export const drawingMarkupsRepository = {
  /** Every markup on one page of one sheet revision, with its comments. */
  async pageWithComments(db: Db, documentVersionId: string, pageNo: number) {
    const rows = await db
      .select()
      .from(drawingMarkups)
      .where(and(eq(drawingMarkups.documentVersionId, documentVersionId), eq(drawingMarkups.pageNo, pageNo)));
    const markups = rows.map(toMarkup).filter((m): m is NonNullable<ReturnType<typeof toMarkup>> => m !== null);
    if (markups.length === 0) return markups;
    // one query for every comment on the page, then stitched, never one per markup
    const ids = new Set(markups.map((m) => m.id));
    const comments = await db
      .select()
      .from(drawingMarkupComments)
      .where(inArray(drawingMarkupComments.markupId, [...ids]));
    const byMarkup = new Map<string, DrawingMarkupComment[]>();
    for (const row of comments.sort((a, b) => a.createdAt - b.createdAt)) {
      const list = byMarkup.get(row.markupId) ?? [];
      list.push(toComment(row));
      byMarkup.set(row.markupId, list);
    }
    for (const markup of markups) markup.comments = byMarkup.get(markup.id) ?? [];
    return markups;
  },

  findById: (db: Db, id: string) =>
    db
      .select()
      .from(drawingMarkups)
      .where(eq(drawingMarkups.id, id))
      .limit(1)
      .then((rows) => rows[0] ?? null),

  /** Writes the markup and queues its push in one transaction. */
  async createLocal(db: Db, input: LocalMarkupInput): Promise<string> {
    const id = `local_${randomUUID()}`;
    await db.transaction(async (tx) => {
      await tx.insert(drawingMarkups).values({
        id,
        projectId: input.projectId,
        documentId: input.documentId,
        documentVersionId: input.documentVersionId,
        pageNo: input.pageNo,
        kind: input.kind,
        geometry: JSON.stringify(input.geometry),
        color: input.color ?? palette.primary500,
        isPendingSync: true,
        updatedAt: Date.now(),
      });
      await tx.insert(outbox).values({
        id: randomUUID(),
        resource: RESOURCE,
        entityId: id,
        projectId: input.projectId,
        operation: "create",
        nextAttemptAt: 0,
      });
    });
    return id;
  },

  /**
   * Replaces the local id with the server's once the push lands, and moves the
   * comments queued against it in the same transaction. Split in two, a crash
   * between them would leave comments pointing at a markup row that no longer
   * exists, and they would wait for a parent that never arrives. An RFI or
   * material approval raised from the pin is re-pointed here too: its own
   * push waits on this id, so it must change in the same write.
   */
  async reconcileCreate(db: Db, localId: string, serverId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(drawingMarkups)
        .set({ id: serverId, isPendingSync: false, updatedAt: Date.now() })
        .where(eq(drawingMarkups.id, localId));
      await tx.update(drawingMarkupComments).set({ markupId: serverId }).where(eq(drawingMarkupComments.markupId, localId));
      await tx.update(rfis).set({ sourceMarkupId: serverId }).where(eq(rfis.sourceMarkupId, localId));
      await tx
        .update(materialApprovals)
        .set({ sourceMarkupId: serverId })
        .where(eq(materialApprovals.sourceMarkupId, localId));
    });
  },

  /** Server rows replace what is held for a page, except anything still queued. */
  async replacePage(
    db: Db,
    documentVersionId: string,
    pageNo: number,
    rows: (LocalMarkupInput & { id: string; resolvedAt?: string | null; comments?: DrawingMarkupComment[] })[],
  ): Promise<void> {
    await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(drawingMarkups)
        .where(and(eq(drawingMarkups.documentVersionId, documentVersionId), eq(drawingMarkups.pageNo, pageNo)));
      const pending = new Set(existing.filter((r) => r.isPendingSync).map((r) => r.id));
      for (const row of existing) {
        if (pending.has(row.id)) continue;
        await tx.delete(drawingMarkups).where(eq(drawingMarkups.id, row.id));
        // a comment still queued outlives the markup row being refreshed under it
        await tx
          .delete(drawingMarkupComments)
          .where(and(eq(drawingMarkupComments.markupId, row.id), eq(drawingMarkupComments.isPendingSync, false)));
      }
      for (const row of rows) {
        if (pending.has(row.id)) continue;
        await tx.insert(drawingMarkups).values({
          id: row.id,
          projectId: row.projectId,
          documentId: row.documentId,
          documentVersionId: row.documentVersionId,
          pageNo: row.pageNo,
          kind: row.kind,
          geometry: JSON.stringify(row.geometry),
          color: row.color ?? palette.primary500,
          resolvedAt: row.resolvedAt ?? null,
          isPendingSync: false,
          updatedAt: Date.now(),
        });
        for (const comment of row.comments ?? []) {
          await tx.insert(drawingMarkupComments).values({
            id: comment.id,
            markupId: row.id,
            projectId: row.projectId,
            body: comment.body,
            mediaKind: comment.mediaKind,
            stagedMediaUri: null,
            mediaDurationSeconds: comment.mediaDurationSeconds,
            assigneeId: comment.assigneeId,
            authorName: comment.authorName ?? "",
            isPendingSync: false,
            createdAt: Date.parse(comment.createdAt) || Date.now(),
          });
        }
      }
    });
  },

  /**
   * Resolves or reopens a markup on the device and queues the change. A
   * markup whose create is still queued is refused: the server has no record
   * to resolve yet, and the reviewer sees why rather than a silent no-op.
   */
  async setResolvedLocal(db: Db, projectId: string, id: string, resolved: boolean): Promise<void> {
    if (id.startsWith("local_")) {
      throw new Error("This markup hasn't reached the server yet. It can be resolved once it has synced.");
    }
    await db.transaction(async (tx) => {
      await tx
        .update(drawingMarkups)
        .set({ resolvedAt: resolved ? new Date().toISOString() : null, isPendingSync: true, updatedAt: Date.now() })
        .where(eq(drawingMarkups.id, id));
      await reviveOrQueue(tx as never, {
        resource: RESOURCE,
        entityId: id,
        projectId,
        operation: "resolve",
        newId: randomUUID(),
      });
    });
  },

  /**
   * Deletes a markup on the device. One the server knows about has its delete
   * queued; one that never left the device is simply dropped with its queued
   * push, because the server has nothing to delete.
   */
  async deleteLocal(db: Db, projectId: string, id: string): Promise<void> {
    if (id.startsWith("local_")) return this.removeLocal(db, id);
    const comments = await db.select().from(drawingMarkupComments).where(eq(drawingMarkupComments.markupId, id));
    await db.transaction(async (tx) => {
      await tx.delete(drawingMarkups).where(eq(drawingMarkups.id, id));
      await tx.delete(drawingMarkupComments).where(eq(drawingMarkupComments.markupId, id));
      for (const comment of comments) {
        await tx.delete(outbox).where(and(eq(outbox.resource, COMMENT_RESOURCE), eq(outbox.entityId, comment.id)));
      }
      // drops any queued resolve for this markup too, then queues the delete
      await enqueueDelete(tx as never, RESOURCE, id, projectId, randomUUID());
    });
    for (const comment of comments) discardStagedMedia(comment.stagedMediaUri);
  },

  /** Drops a markup that never reached the server, with its comments and queued pushes. */
  async removeLocal(db: Db, id: string): Promise<void> {
    const comments = await db.select().from(drawingMarkupComments).where(eq(drawingMarkupComments.markupId, id));
    await db.transaction(async (tx) => {
      await tx.delete(drawingMarkups).where(eq(drawingMarkups.id, id));
      await tx.delete(drawingMarkupComments).where(eq(drawingMarkupComments.markupId, id));
      await tx.delete(outbox).where(and(eq(outbox.resource, RESOURCE), eq(outbox.entityId, id)));
      for (const comment of comments) {
        await tx.delete(outbox).where(and(eq(outbox.resource, COMMENT_RESOURCE), eq(outbox.entityId, comment.id)));
      }
    });
    for (const comment of comments) discardStagedMedia(comment.stagedMediaUri);
  },

  // ── Comments ─────────────────────────────────────────────────────────────

  commentsQuery: (db: Db, markupId: string) =>
    db.select().from(drawingMarkupComments).where(eq(drawingMarkupComments.markupId, markupId)),

  commentById: (db: Db, id: string) =>
    db
      .select()
      .from(drawingMarkupComments)
      .where(eq(drawingMarkupComments.id, id))
      .limit(1)
      .then((rows) => rows[0] ?? null),

  /** Writes the comment and queues its push, media and all, in one transaction. */
  async addCommentLocal(
    db: Db,
    markupId: string,
    projectId: string,
    input: {
      body: string;
      mediaKind?: string | null;
      stagedMediaUri?: string | null;
      mediaDurationSeconds?: number | null;
      assigneeId?: string | null;
    },
  ): Promise<string> {
    const id = `local_${randomUUID()}`;
    await db.transaction(async (tx) => {
      await tx.insert(drawingMarkupComments).values({
        id,
        markupId,
        projectId,
        body: input.body,
        mediaKind: input.mediaKind ?? null,
        stagedMediaUri: input.stagedMediaUri ?? null,
        mediaDurationSeconds: input.mediaDurationSeconds ?? null,
        assigneeId: input.assigneeId ?? null,
        isPendingSync: true,
        createdAt: Date.now(),
      });
      await tx.insert(outbox).values({
        id: randomUUID(),
        resource: COMMENT_RESOURCE,
        entityId: id,
        projectId,
        operation: "create",
        nextAttemptAt: 0,
      });
    });
    return id;
  },

  /** The comment landed: drop the staged media and stop calling it pending. */
  async markCommentSynced(db: Db, id: string, stagedMediaUri: string | null): Promise<void> {
    await db.update(drawingMarkupComments).set({ isPendingSync: false, stagedMediaUri: null }).where(eq(drawingMarkupComments.id, id));
    discardStagedMedia(stagedMediaUri);
  },

};

export type { DrawingMarkupCommentRow };
