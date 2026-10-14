import { htmlFromText } from "@buildpanda/rich-content";
import { settleOutboxItem } from "./sync-write-state";
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
import { done, dropItem, finishItem, isPermanent, skipped, type OutboxHandlerResult } from "./outbox-handler";
import { type OutboxRow } from "./schema";

export async function pushMaterialApprovalOutboxItem(
  db: Db,
  item: OutboxRow,
): Promise<OutboxHandlerResult> {
  if (item.resource === MATERIAL_APPROVALS_RESOURCE) {
    if (item.operation === "decision" && item.entityId.startsWith("local_")) return done(false);

    // The local row is already gone; the server copy is all that is left to remove.
    if (item.operation === "delete") {
      await materialApprovalsApi.remove(item.projectId, item.entityId);
      return finishItem(db, item);
    }

    const row = await materialApprovalsRepository.findById(db, item.entityId);
    if (!row) return dropItem(db, item);

    if (item.operation === "create") {
      // Raised from a pin whose own create has not landed: the markup's push
      // re-points this row to the server id, so wait for it rather than
      // sending a reference the server cannot resolve.
      if (row.sourceMarkupId?.startsWith("local_")) return done(false);
      const server = await materialApprovalsApi.create(item.projectId, {
        title: row.title,
        materialName: row.materialName,
        specification: row.specification,
        quantity: row.quantity,
        unit: row.unit,
        supplier: row.supplier,
        neededBy: row.neededBy,
        description: row.description,
        descriptionHtml: row.descriptionHtml ?? htmlFromText(row.description ?? ""),
        requestedReviewerId: row.requestedReviewerId,
        // The material route takes the sheet and revision but not the pin.
        documentId: row.documentId,
        documentVersionId: row.documentVersionId,
      });
      await materialApprovalsRepository.reconcileCreate(db, item.projectId, row.id, server);
    } else if (item.operation === "decision") {
      try {
        await materialApprovalsApi.update(item.projectId, row.id, {
          status: isApprovalStatus(row.status) ? row.status : "Pending",
          response: row.response,
          responseHtml: row.responseHtml ?? htmlFromText(row.response ?? ""),
        });
      } catch (error) {
        if (isPermanent(error)) {
          const server = await materialApprovalsApi.detail(item.projectId, row.id).catch(() => null);
          if (server) await materialApprovalsRepository.replaceFromServer(db, item.projectId, server);
        }
        throw error;
      }
      settleOutboxItem(db, item);
      return done(true);
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
        descriptionHtml: row.descriptionHtml ?? htmlFromText(row.description ?? ""),
      });
      settleOutboxItem(db, item);
      return done(true);
    }

    return finishItem(db, item);
  }

  if (item.resource === MATERIAL_APPROVAL_COMMENTS_RESOURCE) {
    const comment = await materialApprovalCommentsRepository.findById(db, item.entityId);
    if (!comment) return dropItem(db, item);
    if (comment.approvalId.startsWith("local_")) return done(false);

    const server = await materialApprovalsApi.addComment(
      item.projectId,
      comment.approvalId,
      comment.body,
    );
    await materialApprovalCommentsRepository.reconcileCreate(db, comment.id, server);
    return finishItem(db, item);
  }

  return skipped;
}
