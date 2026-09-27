import { remapQueuedRecord } from "./sync-write-state";
import { randomUUID } from "expo-crypto";
import { and, desc, eq } from "drizzle-orm";
import type { MaterialApproval, MaterialApprovalCreateInput } from "@/api/material-approvals";
import type { Db } from "./client";
import { enqueueDelete, enqueueUpdate } from "./enqueue-update";
import { MATERIAL_APPROVAL_COMMENTS_RESOURCE } from "./material-approval-comments-repository";
import {
  materialApprovalComments,
  materialApprovals,
  outbox,
} from "./schema";
import {
  materialApprovalServerValues,
  type ApprovalDecisionInput,
  type MaterialApprovalDraft,
} from "./material-approval-mappers";

export { toMaterialApproval } from "./material-approval-mappers";
export type { ApprovalDecisionInput, LocalMaterialApproval, MaterialApprovalDraft } from "./material-approval-mappers";

export const MATERIAL_APPROVALS_RESOURCE = "material-approvals";

/**
 * What a request raised on this device carries. The pin it came from is kept
 * locally so the plan can show the link; the server's material route does not
 * take it, so the outbox never sends it.
 */
export type LocalMaterialApprovalDraft = MaterialApprovalDraft & {
  sourceMarkupId?: string | null;
};

function localId(): string {
  return `local_${randomUUID()}`;
}

export const materialApprovalsRepository = {
  listQuery: (db: Db, projectId: string) =>
    db
      .select()
      .from(materialApprovals)
      .where(eq(materialApprovals.projectId, projectId))
      .orderBy(desc(materialApprovals.updatedAt)),

  findById: async (db: Db, id: string) => {
    const [row] = await db
      .select()
      .from(materialApprovals)
      .where(eq(materialApprovals.id, id))
      .limit(1);
    return row;
  },

  /** One request raised from a plan pin, or nothing; the row is read as the plan needs it. */
  bySourceMarkupQuery: (db: Db, markupId: string) =>
    db
      .select()
      .from(materialApprovals)
      .where(eq(materialApprovals.sourceMarkupId, markupId))
      .limit(1),

  async createLocal(db: Db, projectId: string, input: LocalMaterialApprovalDraft): Promise<string> {
    const id = localId();
    await db.transaction((tx) => {
      tx.insert(materialApprovals).values({
        id,
        projectId,
        title: input.title,
        materialName: input.materialName,
        specification: input.specification ?? null,
        quantity: input.quantity ?? 0,
        unit: input.unit ?? "item",
        supplier: input.supplier ?? null,
        neededBy: input.neededBy ?? null,
        description: input.description ?? null,
        status: "Pending",
        requestedReviewerId: input.requestedReviewerId ?? null,
        requestedReviewerName: input.requestedReviewerName,
        documentId: input.documentId ?? null,
        documentVersionId: input.documentVersionId ?? null,
        sourceMarkupId: input.sourceMarkupId ?? null,
        isPendingSync: true,
        serverLastSyncedAt: null,
        updatedAt: Date.now(),
      }).run();
      tx.insert(outbox).values({
        id: randomUUID(),
        resource: MATERIAL_APPROVALS_RESOURCE,
        entityId: id,
        projectId,
        operation: "create",
        nextAttemptAt: 0,
      }).run();
    });
    return id;
  },

  async updateLocal(
    db: Db,
    projectId: string,
    id: string,
    patch: Partial<MaterialApprovalCreateInput>,
  ): Promise<void> {
    await db.transaction((tx) => {
      tx
        .update(materialApprovals)
        .set({
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.materialName !== undefined ? { materialName: patch.materialName } : {}),
          ...(patch.specification !== undefined ? { specification: patch.specification } : {}),
          ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
          ...(patch.unit !== undefined ? { unit: patch.unit } : {}),
          ...(patch.supplier !== undefined ? { supplier: patch.supplier } : {}),
          ...(patch.neededBy !== undefined ? { neededBy: patch.neededBy } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          isPendingSync: true,
          updatedAt: Date.now(),
        })
        .where(eq(materialApprovals.id, id)).run();

      enqueueUpdate(tx, MATERIAL_APPROVALS_RESOURCE, id, projectId, randomUUID());
    });
  },

  /**
   * A decision is queued as its own operation rather than folded into `update`.
   * The backend gates a status change behind `materials:approve` while a field
   * edit only needs `materials:request`, so a PATCH that always carried the
   * status would make a requester's ordinary edit fail with 403. Re-deciding
   * before the first push replaces the queued row: the payload is rebuilt from
   * the local row at send time, so only the latest decision travels.
   */
  async decideLocal(
    db: Db,
    projectId: string,
    id: string,
    decision: ApprovalDecisionInput,
  ): Promise<void> {
    const isRevert = decision.status === "Pending";
    await db.transaction((tx) => {
      tx
        .update(materialApprovals)
        .set({
          status: decision.status,
          response: decision.response,
          reviewedByName: isRevert ? null : decision.reviewerName,
          reviewedAt: isRevert ? null : new Date().toISOString(),
          isPendingSync: true,
          updatedAt: Date.now(),
        })
        .where(eq(materialApprovals.id, id)).run();

      tx
        .delete(outbox)
        .where(
          and(
            eq(outbox.resource, MATERIAL_APPROVALS_RESOURCE),
            eq(outbox.entityId, id),
            eq(outbox.operation, "decision"),
          ),
        ).run();
      tx.insert(outbox).values({
        id: randomUUID(),
        resource: MATERIAL_APPROVALS_RESOURCE,
        entityId: id,
        projectId,
        operation: "decision",
        nextAttemptAt: 0,
      }).run();
    });
  },

  /**
   * Removes the request and its discussion locally and queues the push in one
   * transaction. Comments still waiting to upload go with it: a reply to a
   * request the server is about to lose would only ever 404.
   */
  async deleteLocal(db: Db, projectId: string, id: string): Promise<void> {
    await db.transaction((tx) => {
      const orphaned = tx
        .select({ id: materialApprovalComments.id })
        .from(materialApprovalComments)
        .where(eq(materialApprovalComments.approvalId, id)).all();
      for (const comment of orphaned) {
        tx
          .delete(outbox)
          .where(
            and(
              eq(outbox.resource, MATERIAL_APPROVAL_COMMENTS_RESOURCE),
              eq(outbox.entityId, comment.id),
            ),
          ).run();
      }
      tx.delete(materialApprovalComments).where(eq(materialApprovalComments.approvalId, id)).run();
      tx.delete(materialApprovals).where(eq(materialApprovals.id, id)).run();
      enqueueDelete(tx, MATERIAL_APPROVALS_RESOURCE, id, projectId, randomUUID());
    });
  },

  async markSynced(db: Db, id: string): Promise<void> {
    await db
      .update(materialApprovals)
      .set({ isPendingSync: false, serverLastSyncedAt: Date.now() })
      .where(eq(materialApprovals.id, id));
  },

  /** Server rows never overwrite one still waiting to be pushed, here as in the pull. */
  async replaceFromServer(db: Db, projectId: string, server: MaterialApproval): Promise<void> {
    await db
      .insert(materialApprovals)
      .values(materialApprovalServerValues(projectId, server, Date.now()))
      .onConflictDoUpdate({
        target: materialApprovals.id,
        set: materialApprovalServerValues(projectId, server, Date.now()),
        where: eq(materialApprovals.isPendingSync, false),
      });
  },

  /**
   * Swaps the placeholder for the row the server assigned, and re-points
   * everything that still names the local id: queued decisions, and comments
   * written against the request while it was waiting. Without this both stay
   * anchored to an id the server has never seen and never push.
   */
  async reconcileCreate(
    db: Db,
    projectId: string,
    localRowId: string,
    server: MaterialApproval,
  ): Promise<void> {
    const now = Date.now();
    await db.transaction((tx) => {
      // The DTO does not echo the sheet or pin back; keep what was sent so the
      // plan still shows the link after the id changes.
      const [local] = tx
        .select()
        .from(materialApprovals)
        .where(eq(materialApprovals.id, localRowId))
        .limit(1).all();
      const hasEdits = remapQueuedRecord(tx, "material-approvals", localRowId, server.id);
      if (!local) return;
      tx.delete(materialApprovals).where(eq(materialApprovals.id, localRowId)).run();
      const values = {
        ...materialApprovalServerValues(projectId, server, now),
        documentId: local?.documentId ?? null,
        documentVersionId: local?.documentVersionId ?? null,
        sourceMarkupId: local?.sourceMarkupId ?? null,
        ...(hasEdits ? local : {}),
        id: server.id,
        isPendingSync: hasEdits,
      };
      // A concurrent pull may already have received the server-assigned ID.
      // Preserve any later local edit on that row while reconciling the draft.
      tx.insert(materialApprovals).values(values).onConflictDoUpdate({
        target: materialApprovals.id,
        set: values,
        where: eq(materialApprovals.isPendingSync, false),
      }).run();

      tx
        .update(materialApprovalComments)
        .set({ approvalId: server.id })
        .where(eq(materialApprovalComments.approvalId, localRowId)).run();

    });
  },

  /** Server rows never overwrite a row the crew member has edited locally. */
  async upsertFromServer(
    db: Db,
    projectId: string,
    rows: readonly MaterialApproval[],
  ): Promise<void> {
    if (rows.length === 0) return;
    const now = Date.now();
    await db.transaction((tx) => {
      for (const row of rows) {
        const values = materialApprovalServerValues(projectId, row, now);
        const { id: _id, projectId: _projectId, ...mutable } = values;
        tx
          .insert(materialApprovals)
          .values(values)
          .onConflictDoUpdate({
            target: materialApprovals.id,
            set: mutable,
            where: eq(materialApprovals.isPendingSync, false),
          }).run();
      }
    });
  },
};
