import { randomUUID } from "expo-crypto";
import { asc, eq } from "drizzle-orm";
import type { RfiComment } from "@/api/rfis";
import type { Db } from "./client";
import { outbox, rfiComments, type RfiCommentRow } from "./schema";

export function toComment(row: RfiCommentRow) {
  return {
    id: row.id,
    rfiId: row.rfiId,
    authorName: row.authorName,
    body: row.body,
    contentHtml: row.contentHtml,
    createdAt: row.createdAt,
    isPendingSync: row.isPendingSync,
  };
}

export const rfiCommentsRepository = {
  listQuery: (db: Db, rfiId: string) =>
    db
      .select()
      .from(rfiComments)
      .where(eq(rfiComments.rfiId, rfiId))
      .orderBy(asc(rfiComments.createdAt)),

  /** Comment row and its outbox entry are written together so they can't diverge. */
  async createLocal(
    db: Db,
    projectId: string,
    rfiId: string,
    body: string,
    authorName: string,
    contentHtml?: string | null,
  ): Promise<string> {
    const id = `local_${randomUUID()}`;

    await db.transaction(async (tx) => {
      await tx.insert(rfiComments).values({
        id,
        rfiId,
        projectId,
        authorName,
        body,
        contentHtml: contentHtml ?? null,
        createdAt: Date.now(),
        isPendingSync: true,
      });

      await tx.insert(outbox).values({
        id: randomUUID(),
        resource: "rfi-comments",
        entityId: id,
        projectId,
        operation: "create",
        nextAttemptAt: 0,
      });
    });

    return id;
  },

  async reconcileCreate(db: Db, localRowId: string, server: RfiComment): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(rfiComments).where(eq(rfiComments.id, localRowId));
      await tx.insert(rfiComments).values({
        id: server.id,
        rfiId: server.rfiId,
        projectId: "",
        authorName: server.authorName,
        body: server.body,
        contentHtml: server.contentHtml,
        createdAt: Date.parse(server.createdAt) || Date.now(),
        isPendingSync: false,
        serverLastSyncedAt: Date.now(),
      });
    });
  },

  /** Never overwrites a comment still waiting to be pushed. */
  async upsertFromServer(
    db: Db,
    projectId: string,
    rows: readonly RfiComment[],
  ): Promise<void> {
    if (rows.length === 0) return;
    const now = Date.now();
    await db.transaction(async (tx) => {
      for (const row of rows) {
        await tx
          .insert(rfiComments)
          .values({
            id: row.id,
            rfiId: row.rfiId,
            projectId,
            authorName: row.authorName,
            body: row.body,
            contentHtml: row.contentHtml,
            createdAt: Date.parse(row.createdAt) || now,
            isPendingSync: false,
            serverLastSyncedAt: now,
          })
          .onConflictDoUpdate({
            target: rfiComments.id,
            set: { body: row.body, contentHtml: row.contentHtml, authorName: row.authorName, serverLastSyncedAt: now },
            where: eq(rfiComments.isPendingSync, false),
          });
      }
    });
  },
};
