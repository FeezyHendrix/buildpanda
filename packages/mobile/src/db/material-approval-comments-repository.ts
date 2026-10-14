import { repositoryAccess, requireDbPermission } from "./permissions";
import { features } from "@/lib/feature-access";
import { randomUUID } from "expo-crypto";
import { asc, eq } from "drizzle-orm";
import type { ApprovalComment } from "@/api/material-approvals";
import type { Db } from "./client";
import { materialApprovals, materialApprovalComments, outbox, type MaterialApprovalCommentRow } from "./schema";

const access = repositoryAccess(features.materialApprovals);

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
      .where(access.where(db, materialApprovalComments.projectId, eq(materialApprovalComments.approvalId, approvalId)))
      .orderBy(asc(materialApprovalComments.createdAt)),

  findById: async (db: Db, id: string) => {
    const [row] = await db
      .select()
      .from(materialApprovalComments)
      .where(access.where(db, materialApprovalComments.projectId, eq(materialApprovalComments.id, id)))
      .limit(1);
    return row;
  },

  /** Comment row and its outbox entry are written together so they can't diverge. */
  async createLocal(db: Db, projectId: string, comment: ApprovalCommentDraft): Promise<string> {
    access.record(db, materialApprovals, comment.approvalId, projectId);
    access.require(db, projectId);
    requireDbPermission(db, projectId, "comments", "post");
    const id = `local_${randomUUID()}`;
    await access.transaction(db, projectId, "comment", (tx) => {
      tx.insert(materialApprovalComments).values({
        id,
        approvalId: comment.approvalId,
        projectId,
        authorName: comment.authorName,
        body: comment.body,
        createdAt: Date.now(),
        isPendingSync: true,
      }).run();
      tx.insert(outbox).values({
        id: randomUUID(),
        resource: MATERIAL_APPROVAL_COMMENTS_RESOURCE,
        entityId: id,
        projectId,
        operation: "create",
        nextAttemptAt: 0,
      }).run();
    });
    return id;
  },

  async reconcileCreate(db: Db, localRowId: string, server: ApprovalComment): Promise<void> {
    const [existing] = await db
      .select()
      .from(materialApprovalComments)
      .where(access.where(db, materialApprovalComments.projectId, eq(materialApprovalComments.id, localRowId)))
      .limit(1);
    if (!existing) return;

    await access.transaction(db, existing.projectId, "read", (tx) => {
      tx.delete(materialApprovalComments).where(access.where(db, materialApprovalComments.projectId, eq(materialApprovalComments.id, localRowId))).run();
      tx.insert(materialApprovalComments).values({
        id: server.id,
        approvalId: server.approvalId,
        projectId: existing.projectId,
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
    projectId: string,
    rows: readonly ApprovalComment[],
  ): Promise<void> {
    access.require(db, projectId);
    if (rows.length === 0) return;
    const now = Date.now();
    await access.transaction(db, projectId, "read", (tx) => {
      for (const row of rows) {
        tx
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
          }).run();
      }
    });
  },
};
