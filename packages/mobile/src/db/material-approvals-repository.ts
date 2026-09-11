import { randomUUID } from "expo-crypto";
import { and, desc, eq } from "drizzle-orm";
import type { MaterialApproval, MaterialApprovalCreateInput } from "@/api/material-approvals";
import type { Db } from "./client";
import { enqueueDelete } from "./enqueue-update";
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

function localId(): string {
  return `local_${randomUUID()}`;
}

async function hasQueuedUpdate(
  tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
  entityId: string,
): Promise<boolean> {
  const [row] = await tx
    .select({ id: outbox.id })
    .from(outbox)
    .where(
      and(
        eq(outbox.resource, MATERIAL_APPROVALS_RESOURCE),
        eq(outbox.entityId, entityId),
        eq(outbox.operation, "update"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function queueMaterialApprovalUpdate(
  tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
  id: string,
  projectId: string,
): Promise<void> {
  if (await hasQueuedUpdate(tx, id)) return;
  await tx.insert(outbox).values({
    id: randomUUID(),
    resource: MATERIAL_APPROVALS_RESOURCE,
    entityId: id,
    projectId,
    operation: "update",
    nextAttemptAt: 0,
  });
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

  async createLocal(db: Db, projectId: string, input: MaterialApprovalDraft): Promise<string> {
    const id = localId();
    await db.transaction(async (tx) => {
      await tx.insert(materialApprovals).values({
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
        isPendingSync: true,
        serverLastSyncedAt: null,
        updatedAt: Date.now(),
      });
      await tx.insert(outbox).values({
        id: randomUUID(),
        resource: MATERIAL_APPROVALS_RESOURCE,
        entityId: id,
        projectId,
        operation: "create",
        nextAttemptAt: 0,
      });
    });
    return id;
  },

  async updateLocal(
    db: Db,
    projectId: string,
    id: string,
    patch: Partial<MaterialApprovalCreateInput>,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
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
        .where(eq(materialApprovals.id, id));

      await queueMaterialApprovalUpdate(tx, id, projectId);
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
    await db.transaction(async (tx) => {
      await tx
        .update(materialApprovals)
        .set({
          status: decision.status,
          response: decision.response,
          reviewedByName: isRevert ? null : decision.reviewerName,
          reviewedAt: isRevert ? null : new Date().toISOString(),
          isPendingSync: true,
          updatedAt: Date.now(),
        })
        .where(eq(materialApprovals.id, id));

      await tx
        .delete(outbox)
        .where(
          and(
            eq(outbox.resource, MATERIAL_APPROVALS_RESOURCE),
            eq(outbox.entityId, id),
            eq(outbox.operation, "decision"),
          ),
        );
      await tx.insert(outbox).values({
        id: randomUUID(),
        resource: MATERIAL_APPROVALS_RESOURCE,
        entityId: id,
        projectId,
        operation: "decision",
        nextAttemptAt: 0,
      });
    });
  },

  /**
   * Removes the request and its discussion locally and queues the push in one
   * transaction. Comments still waiting to upload go with it: a reply to a
   * request the server is about to lose would only ever 404.
   */
  async deleteLocal(db: Db, projectId: string, id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const orphaned = await tx
        .select({ id: materialApprovalComments.id })
        .from(materialApprovalComments)
        .where(eq(materialApprovalComments.approvalId, id));
      for (const comment of orphaned) {
        await tx
          .delete(outbox)
          .where(
            and(
              eq(outbox.resource, MATERIAL_APPROVAL_COMMENTS_RESOURCE),
              eq(outbox.entityId, comment.id),
            ),
          );
      }
      await tx.delete(materialApprovalComments).where(eq(materialApprovalComments.approvalId, id));
      await tx.delete(materialApprovals).where(eq(materialApprovals.id, id));
      await enqueueDelete(tx as never, MATERIAL_APPROVALS_RESOURCE, id, projectId, randomUUID());
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
    await db.transaction(async (tx) => {
      await tx.delete(materialApprovals).where(eq(materialApprovals.id, localRowId));
      await tx.insert(materialApprovals).values(materialApprovalServerValues(projectId, server, now));

      await tx
        .update(materialApprovalComments)
        .set({ approvalId: server.id })
        .where(eq(materialApprovalComments.approvalId, localRowId));

      await tx
        .update(outbox)
        .set({ entityId: server.id })
        .where(
          and(
            eq(outbox.resource, MATERIAL_APPROVALS_RESOURCE),
            eq(outbox.entityId, localRowId),
          ),
        );
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
    await db.transaction(async (tx) => {
      for (const row of rows) {
        const values = materialApprovalServerValues(projectId, row, now);
        const { id: _id, projectId: _projectId, ...mutable } = values;
        await tx
          .insert(materialApprovals)
          .values(values)
          .onConflictDoUpdate({
            target: materialApprovals.id,
            set: mutable,
            where: eq(materialApprovals.isPendingSync, false),
          });
      }
    });
  },
};
