import type { Approval, ApprovalComment, ApprovalStatus } from "./types.ts";

export interface MaterialApprovalDetailRow {
  approval_id: string;
  material_name: string;
  specification: string | null;
  quantity: string | number;
  unit: string;
  supplier: string | null;
  needed_by: string | null;
  phase_id: string | null;
  activity_id: string | null;
}

export interface MaterialApprovalJoinedRow extends MaterialApprovalDetailRow {
  phase_name: string | null;
  activity_name: string | null;
}

export interface MaterialApprovalDetails {
  materialName: string;
  specification: string | null;
  quantity: number;
  unit: string;
  supplier: string | null;
  neededBy: string | null;
  phaseId: string | null;
  phaseName: string | null;
  activityId: string | null;
  activityName: string | null;
}

export interface MaterialApproval extends Approval, MaterialApprovalDetails {}

export interface MaterialApprovalDetail extends MaterialApproval {
  comments: ApprovalComment[];
}

export interface CreateMaterialApprovalInput {
  title: string;
  materialName: string;
  specification?: string | null;
  quantity?: number;
  unit?: string;
  supplier?: string | null;
  neededBy?: string | null;
  phaseId?: string | null;
  activityId?: string | null;
  description?: string | null;
  descriptionHtml?: string | null;
  dueDate?: string | null;
  requestedReviewerId?: string | null;
  documentId?: string | null;
  documentVersionId?: string | null;
  sourceMarkupId?: string | null;
}

export interface UpdateMaterialApprovalInput {
  title?: string;
  materialName?: string;
  specification?: string | null;
  quantity?: number;
  unit?: string;
  supplier?: string | null;
  neededBy?: string | null;
  phaseId?: string | null;
  activityId?: string | null;
  description?: string | null;
  descriptionHtml?: string | null;
  status?: ApprovalStatus;
  response?: string | null;
  responseHtml?: string | null;
  dueDate?: string | null;
  requestedReviewerId?: string | null;
}
