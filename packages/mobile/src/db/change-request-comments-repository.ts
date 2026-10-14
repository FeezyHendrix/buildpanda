import { repositoryAccess, requireDbPermission } from "./permissions";
import { features } from "@/lib/feature-access";
import { randomUUID } from "expo-crypto";
import { asc, eq } from "drizzle-orm";
import type { ChangeRequestComment } from "@/api/change-requests";
import type { Db } from "./client";
import { changeRequests, changeRequestComments, outbox, type ChangeRequestCommentRow } from "./schema";

const access = repositoryAccess(features.changeRequests);

export const CHANGE_REQUEST_COMMENTS_RESOURCE = "change-request-comments";

export function toChangeRequestComment(row: ChangeRequestCommentRow) {
  return {
    id: row.id,
    changeRequestId: row.changeRequestId,
    authorName: row.authorName,
    body: row.body,
    createdAt: row.createdAt,
    isPendingSync: row.isPendingSync,
  };
}

/**
 * Local-first comments on a change request, mirroring rfi_comments.
 *
 * A comment typed on site with no signal is a real record: it lands here with
 * `isPendingSync` and the outbox pushes it once the request has a server id.
 */
export const changeRequestCommentsRepository = {
  listQuery: (db: Db, changeRequestId: string) =>
    db
      .select()
      .from(changeRequestComments)
      .where(access.where(db, changeRequestComments.projectId, eq(changeRequestComments.changeRequestId, changeRequestId)))
      .orderBy(asc(changeRequestComments.createdAt)),

  /** Comment row and its outbox entry are written together so they can't diverge. */
  async addLocal(
    db: Db,
    changeRequestId: string,
    projectId: string,
    body: string,
    authorName: string,
  ): Promise<string> {
    access.record(db, changeRequests, changeRequestId, projectId);
    access.require(db, projectId, "comment");
    requireDbPermission(db, projectId, "comments", "post");
    const id = `local_${randomUUID()}`;

    await access.transaction(db, projectId, "comment", (tx) => {
      tx.insert(changeRequestComments).values({
        id,
        changeRequestId,
        projectId,
        authorName,
        body,
        createdAt: Date.now(),
        isPendingSync: true,
        serverLastSyncedAt: null,
      }).run();

      tx.insert(outbox).values({
        id: randomUUID(),
        resource: CHANGE_REQUEST_COMMENTS_RESOURCE,
        entityId: id,
        projectId,
        operation: "create",
        nextAttemptAt: 0,
      }).run();
    });

    return id;
  },

  /** Replaces the local placeholder with the row the server assigned, keeping its project. */
  async reconcileCreate(db: Db, localId: string, server: ChangeRequestComment): Promise<void> {
    await db.transaction((tx) => {
      const [local] = tx
        .select({
          projectId: changeRequestComments.projectId,
          changeRequestId: changeRequestComments.changeRequestId,
        })
        .from(changeRequestComments)
        .where(access.where(db, changeRequestComments.projectId, eq(changeRequestComments.id, localId)))
        .limit(1).all();
      tx.delete(changeRequestComments).where(access.where(db, changeRequestComments.projectId, eq(changeRequestComments.id, localId))).run();
      tx.insert(changeRequestComments).values({
        id: server.id,
        changeRequestId: server.changeRequestId || local?.changeRequestId || "",
        projectId: local?.projectId ?? "",
        authorName: server.authorName,
        body: server.body,
        createdAt: Date.parse(server.createdAt) || Date.now(),
        isPendingSync: false,
        serverLastSyncedAt: Date.now(),
      }).run();
    });
  },

  /** Never overwrites a comment still waiting to be pushed. */
  async upsertFromServer(
    db: Db,
    changeRequestId: string,
    projectId: string,
    rows: readonly ChangeRequestComment[],
  ): Promise<void> {
    access.require(db, projectId);
    if (rows.length === 0) return;
    const now = Date.now();
    await access.transaction(db, projectId, "read", (tx) => {
      for (const row of rows) {
        tx
          .insert(changeRequestComments)
          .values({
            id: row.id,
            changeRequestId: row.changeRequestId || changeRequestId,
            projectId,
            authorName: row.authorName,
            body: row.body,
            createdAt: Date.parse(row.createdAt) || now,
            isPendingSync: false,
            serverLastSyncedAt: now,
          })
          .onConflictDoUpdate({
            target: changeRequestComments.id,
            set: { body: row.body, authorName: row.authorName, serverLastSyncedAt: now },
            where: eq(changeRequestComments.isPendingSync, false),
          }).run();
      }
    });
  },

  async markSynced(db: Db, id: string): Promise<void> {
    await db
      .update(changeRequestComments)
      .set({ isPendingSync: false, serverLastSyncedAt: Date.now() })
      .where(access.where(db, changeRequestComments.projectId, eq(changeRequestComments.id, id)));
  },
};
