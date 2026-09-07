import { eq } from "drizzle-orm";
import { isApprovalStatus, materialApprovalsApi } from "@/api/material-approvals";
import type { Db } from "./client";
import {
  materialApprovalCommentsRepository,
  MATERIAL_APPROVAL_COMMENTS_RESOURCE,
} from "./material-approval-comments-repository";
import {
  materialApprovalsRepository,
  MATERIAL_APPROVALS_RESOURCE,
} from "./material-approvals-repository";
import { done, skipped, type OutboxHandlerResult } from "./outbox-handler";
import { outbox, type OutboxRow } from "./schema";

function isPermanentRejection(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500 && status !== 401 && status !== 429;
}

export async function pushMaterialApprovalOutboxItem(
  db: Db,
  item: OutboxRow,
): Promise<OutboxHandlerResult> {
  if (item.resource === MATERIAL_APPROVALS_RESOURCE) {
    if (item.operation === "decision" && item.entityId.startsWith("local_")) return done(false);

    const row = await materialApprovalsRepository.findById(db, item.entityId);
    if (!row) {
      await db.delete(outbox).where(eq(outbox.id, item.id));
      return done(false);
    }

    if (item.operation === "create") {
      const server = await materialApprovalsApi.create(item.projectId, {
        title: row.title,
        materialName: row.materialName,
        specification: row.specification,
        quantity: row.quantity,
        unit: row.unit,
        supplier: row.supplier,
        neededBy: row.neededBy,
        description: row.description,
        requestedReviewerId: row.requestedReviewerId,
      });
      await materialApprovalsRepository.reconcileCreate(db, item.projectId, row.id, server);
    } else if (item.operation === "decision") {
      try {
        await materialApprovalsApi.update(item.projectId, row.id, {
          status: isApprovalStatus(row.status) ? row.status : "Pending",
          response: row.response,
        });
      } catch (error) {
        if (isPermanentRejection(error)) {
          const server = await materialApprovalsApi.detail(item.projectId, row.id).catch(() => null);
          if (server) await materialApprovalsRepository.replaceFromServer(db, item.projectId, server);
        }
        throw error;
      }
      await materialApprovalsRepository.markSynced(db, row.id);
    } else {
      await materialApprovalsApi.update(item.projectId, row.id, {
        title: row.title,
        materialName: row.materialName,
        specification: row.specification,
        quantity: row.quantity,
        unit: row.unit,
        supplier: row.supplier,
        neededBy: row.neededBy,
        description: row.description,
      });
      await materialApprovalsRepository.markSynced(db, row.id);
    }

    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(true);
  }

  if (item.resource === MATERIAL_APPROVAL_COMMENTS_RESOURCE) {
    const comment = await materialApprovalCommentsRepository.findById(db, item.entityId);
    if (!comment) {
      await db.delete(outbox).where(eq(outbox.id, item.id));
      return done(false);
    }
    if (comment.approvalId.startsWith("local_")) return done(false);

    const server = await materialApprovalsApi.addComment(
      item.projectId,
      comment.approvalId,
      comment.body,
    );
    await materialApprovalCommentsRepository.reconcileCreate(db, comment.id, server);
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(true);
  }

  return skipped;
}
