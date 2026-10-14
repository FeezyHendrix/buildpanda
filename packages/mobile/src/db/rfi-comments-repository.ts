import { rfiCommentReadWhere, requireRfiRead } from "./rfi-access";
import { repositoryAccess, requireDbPermission } from "./permissions";
import { features } from "@/lib/feature-access";
import { randomUUID } from "expo-crypto";
import { asc, eq } from "drizzle-orm";
import type { RfiComment } from "@/api/rfis";
import type { Db } from "./client";
import { outbox, rfiComments, rfis, type RfiCommentRow } from "./schema";

const access = repositoryAccess(features.rfis);

export function toComment(row: RfiCommentRow) {
  return {
    id: row.id,
    rfiId: row.rfiId,
    authorName: row.authorName,
    body: row.body,
    contentHtml: row.contentHtml,
    createdAt: row.createdAt,
    /** True when this reply is (or is queued to become) the RFI's official answer. */
    official: row.official,
    isPendingSync: row.isPendingSync,
  };
}

export const rfiCommentsRepository = {
  listQuery: (db: Db, rfiId: string) =>
    db
      .select()
      .from(rfiComments)
      .where(rfiCommentReadWhere(db, eq(rfiComments.rfiId, rfiId)))
      .orderBy(asc(rfiComments.createdAt)),

  /**
   * Comment row and its outbox entry are written together so they can't diverge.
   *
   * An official response also mirrors the server's effect on the RFI row
   * (Answered, official text) so the header reflects it with no signal; the
   * RFI row is deliberately left un-flagged, since the comment carries the push.
   */
  async createLocal(
    db: Db,
    projectId: string,
    rfiId: string,
    body: string,
    authorName: string,
    contentHtml?: string | null,
    official = false,
  ): Promise<string> {
    access.require(db, projectId);
    requireDbPermission(db, projectId, official ? "rfis" : "comments", official ? "respond" : "post");
    if (official) access.require(db, projectId, "officialResponse");
    const parent = requireRfiRead(db, projectId, rfiId);
    if (official && ["Closed", "Void"].includes(String(parent.status))) throw new Error("This RFI is closed.");
    const id = `local_${randomUUID()}`;
    const now = Date.now();

    await access.transaction(db, projectId, official ? "officialResponse" : "comment", (tx) => {
      tx.insert(rfiComments).values({
        id,
        rfiId,
        projectId,
        authorName,
        body,
        contentHtml: contentHtml ?? null,
        createdAt: now,
        official,
        isProposedResponse: false,
        isPendingSync: true,
      }).run();

      if (official) {
        tx
          .update(rfis)
          .set({ status: "Answered", officialResponse: body, updatedAt: now })
          .where(access.where(db, rfis.projectId, eq(rfis.id, rfiId))).run();
      }

      tx.insert(outbox).values({
        id: randomUUID(),
        resource: "rfi-comments",
        entityId: id,
        projectId,
        operation: "create",
        nextAttemptAt: 0,
      }).run();
    });

    return id;
  },

  async reconcileCreate(
    db: Db,
    localRowId: string,
    server: RfiComment,
    official = false,
  ): Promise<void> {
    await db.transaction((tx) => {
      const [local] = tx
        .select({ projectId: rfiComments.projectId })
        .from(rfiComments)
        .where(access.where(db, rfiComments.projectId, eq(rfiComments.id, localRowId)))
        .limit(1).all();
      tx.delete(rfiComments).where(access.where(db, rfiComments.projectId, eq(rfiComments.id, localRowId))).run();
      tx
        .insert(rfiComments)
        .values({
          id: server.id,
          rfiId: server.rfiId,
          projectId: local?.projectId ?? "",
          authorName: server.authorName,
          body: server.body,
          contentHtml: server.contentHtml,
          createdAt: Date.parse(server.createdAt) || Date.now(),
          official,
          isProposedResponse: server.isProposedResponse ?? true,
          isPendingSync: false,
          serverLastSyncedAt: Date.now(),
        })
        // A detail pull may already have landed the server row; take it over.
        .onConflictDoUpdate({
          target: rfiComments.id,
          set: { official, isProposedResponse: server.isProposedResponse ?? true, isPendingSync: false, serverLastSyncedAt: Date.now() },
        }).run();
    });
  },

  /** Never overwrites a comment still waiting to be pushed. */
  async upsertFromServer(
    db: Db,
    projectId: string,
    rows: readonly RfiComment[],
  ): Promise<void> {
    access.require(db, projectId);
    if (rows.length === 0) return;
    const now = Date.now();
    await access.transaction(db, projectId, "read", (tx) => {
      for (const row of rows) {
        tx
          .insert(rfiComments)
          .values({
            id: row.id,
            rfiId: row.rfiId,
            projectId,
            authorName: row.authorName,
            body: row.body,
            isProposedResponse: row.isProposedResponse ?? true,
            contentHtml: row.contentHtml,
            createdAt: Date.parse(row.createdAt) || now,
            isPendingSync: false,
            serverLastSyncedAt: now,
          })
          // `official` is not in the set: the server does not flag it, so a
          // pull must not erase what the reconcile recorded.
          .onConflictDoUpdate({
            target: rfiComments.id,
            set: { isProposedResponse: row.isProposedResponse ?? true, body: row.body, contentHtml: row.contentHtml, authorName: row.authorName, serverLastSyncedAt: now },
            where: eq(rfiComments.isPendingSync, false),
          }).run();
      }
    });
  },
};
