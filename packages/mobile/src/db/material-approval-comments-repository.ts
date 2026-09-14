import { randomUUID } from "expo-crypto";
import { asc, eq } from "drizzle-orm";
import type { ApprovalComment } from "@/api/material-approvals";
import type { Db } from "./client";
import { materialApprovalComments, outbox, type MaterialApprovalCommentRow } from "./schema";

export const MATERIAL_APPROVAL_COMMENTS_RESOURCE = "material-approval-comments";

export interface LocalMaterialApprovalComment {
  id: string;
  approvalId: string;
  authorName: string;
  body: string;
  createdAt: number;
  isPendingSync: boolean;
}

export interface ApprovalCommentDraft {
  approvalId: string;
  body: string;
  authorName: string;
}

export function toApprovalComment(row: MaterialApprovalCommentRow): LocalMaterialApprovalComment {
  return {
    id: row.id,
    approvalId: row.approvalId,
    authorName: row.authorName,
    body: row.body,
    createdAt: row.createdAt,
    isPendingSync: row.isPendingSync,
  };
}

export const materialApprovalCommentsRepository = {
  listQuery: (db: Db, approvalId: string) =>
    db
      .select()
      .from(materialApprovalComments)
      .where(eq(materialApprovalComments.approvalId, approvalId))
      .orderBy(asc(materialApprovalComments.createdAt)),

  findById: async (db: Db, id: string) => {
    const [row] = await db
      .select()
      .from(materialApprovalComments)
      .where(eq(materialApprovalComments.id, id))
      .limit(1);
    return row;
  },

  /** Comment row and its outbox entry are written together so they can't diverge. */
  async createLocal(db: Db, projectId: string, comment: ApprovalCommentDraft): Promise<string> {
    const id = `local_${randomUUID()}`;
    await db.transaction(async (tx) => {
      await tx.insert(materialApprovalComments).values({
        id,
        approvalId: comment.approvalId,
        projectId,
        authorName: comment.authorName,
        body: comment.body,
        createdAt: Date.now(),
        isPendingSync: true,
      });
      await tx.insert(outbox).values({
        id: randomUUID(),
        resource: MATERIAL_APPROVAL_COMMENTS_RESOURCE,
        entityId: id,
        projectId,
        operation: "create",
        nextAttemptAt: 0,
      });
    });
    return id;
  },

  async reconcileCreate(db: Db, localRowId: string, server: ApprovalComment): Promise<void> {
    const [existing] = await db
      .select()
      .from(materialApprovalComments)
      .where(eq(materialApprovalComments.id, localRowId))
      .limit(1);
    if (!existing) return;

    await db.transaction(async (tx) => {
      await tx.delete(materialApprovalComments).where(eq(materialApprovalComments.id, localRowId));
      await tx.insert(materialApprovalComments).values({
        id: server.id,
        approvalId: server.approvalId,
        projectId: existing.projectId,
        authorName: server.authorName,
        body: server.body,
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
    rows: readonly ApprovalComment[],
  ): Promise<void> {
    if (rows.length === 0) return;
    const now = Date.now();
    await db.transaction(async (tx) => {
      for (const row of rows) {
        await tx
          .insert(materialApprovalComments)
          .values({
            id: row.id,
            approvalId: row.approvalId,
            projectId,
            authorName: row.authorName,
            body: row.body,
            createdAt: Date.parse(row.createdAt) || now,
            isPendingSync: false,
            serverLastSyncedAt: now,
          })
          .onConflictDoUpdate({
            target: materialApprovalComments.id,
            set: { body: row.body, authorName: row.authorName, serverLastSyncedAt: now },
            where: eq(materialApprovalComments.isPendingSync, false),
          });
      }
    });
  },
};
