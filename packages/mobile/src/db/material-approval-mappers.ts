import {
  isApprovalStatus,
  type ApprovalStatus,
  type MaterialApproval,
  type MaterialApprovalCreateInput,
} from "@/api/material-approvals";
import type { MaterialApprovalRow } from "./schema";

export interface LocalMaterialApproval {
  id: string;
  projectId: string;
  title: string;
  materialName: string;
  specification: string | null;
  quantity: number;
  unit: string;
  supplier: string | null;
  neededBy: string | null;
  phaseName: string | null;
  activityName: string | null;
  description: string | null;
  status: ApprovalStatus;
  response: string | null;
  requestedReviewerName: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  commentCount: number;
  isPendingSync: boolean;
}

export interface MaterialApprovalDraft extends MaterialApprovalCreateInput {
  requestedReviewerName: string | null;
}

export interface ApprovalDecisionInput {
  status: ApprovalStatus;
  response: string | null;
  reviewerName: string | null;
}

export function toMaterialApproval(row: MaterialApprovalRow): LocalMaterialApproval {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    materialName: row.materialName,
    specification: row.specification,
    quantity: row.quantity,
    unit: row.unit,
    supplier: row.supplier,
    neededBy: row.neededBy,
    phaseName: row.phaseName,
    activityName: row.activityName,
    description: row.description,
    status: isApprovalStatus(row.status) ? row.status : "Pending",
    response: row.response,
    requestedReviewerName: row.requestedReviewerName,
    reviewedByName: row.reviewedByName,
    reviewedAt: row.reviewedAt,
    commentCount: row.commentCount,
    isPendingSync: row.isPendingSync,
  };
}

export function materialApprovalServerValues(
  projectId: string,
  row: MaterialApproval,
  now: number,
) {
  return {
    id: row.id,
    projectId,
    title: row.title,
    materialName: row.materialName,
    specification: row.specification,
    quantity: row.quantity,
    unit: row.unit,
    supplier: row.supplier,
    neededBy: row.neededBy,
    phaseId: row.phaseId,
    phaseName: row.phaseName,
    activityId: row.activityId,
    activityName: row.activityName,
    description: row.description,
    status: row.status,
    response: row.response,
    dueDate: row.dueDate,
    requestedReviewerId: row.requestedReviewerId,
    requestedReviewerName: row.requestedReviewerName,
    reviewedByName: row.reviewedByName,
    reviewedAt: row.reviewedAt,
    commentCount: row.commentCount,
    isPendingSync: false,
    serverLastSyncedAt: now,
    updatedAt: now,
  };
}
