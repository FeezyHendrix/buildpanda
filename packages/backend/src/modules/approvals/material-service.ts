import { NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type {
  MaterialApprovalDetailPatch,
  MaterialApprovalsRepository,
} from "./material-repository.ts";
import type {
  CreateMaterialApprovalInput,
  MaterialApproval,
  MaterialApprovalDetail,
  MaterialApprovalDetails,
  MaterialApprovalJoinedRow,
  UpdateMaterialApprovalInput,
} from "./material-types.ts";
import {
  type ApprovalsDeps,
  notifyApprovalDecided,
  notifyApprovalReviewer,
} from "./notify.ts";
import type { ApprovalUpdatePatch } from "./repository.ts";
import {
  DECISION_STATUSES,
  type ApprovalComment,
  type ApprovalCommentRow,
  type ApprovalRow,
} from "./types.ts";

const MISSING_DETAILS: MaterialApprovalDetails = {
  materialName: "",
  specification: null,
  quantity: 0,
  unit: "item",
  supplier: null,
  neededBy: null,
  phaseId: null,
  phaseName: null,
  activityId: null,
  activityName: null,
};

function toDetails(row: MaterialApprovalJoinedRow | undefined): MaterialApprovalDetails {
  if (!row) return MISSING_DETAILS;
  return {
    materialName: row.material_name,
    specification: row.specification,
    quantity: Number(row.quantity),
    unit: row.unit,
    supplier: row.supplier,
    neededBy: row.needed_by,
    phaseId: row.phase_id,
    phaseName: row.phase_name,
    activityId: row.activity_id,
    activityName: row.activity_name,
  };
}

function toMaterialApproval(
  row: ApprovalRow,
  details: MaterialApprovalJoinedRow | undefined,
  commentCount: number,
): MaterialApproval {
  return {
    id: row.id,
    projectId: row.project_id,
    kind: row.kind,
    title: row.title,
    category: row.category,
    description: row.description,
    descriptionHtml: row.description_html,
    status: row.status,
    response: row.response,
    responseHtml: row.response_html,
    dueDate: row.due_date,
    submittedById: row.submitted_by_id,
    requestedReviewerId: row.requested_reviewer_id,
    requestedReviewerName: row.requested_reviewer_name,
    reviewedById: row.reviewed_by_id,
    reviewedByName: row.reviewed_by_name,
    reviewedAt: row.reviewed_at,
    commentCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...toDetails(details),
  };
}

function toComment(row: ApprovalCommentRow): ApprovalComment {
  return {
    id: row.id,
    approvalId: row.approval_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

function detailPatchFrom(input: UpdateMaterialApprovalInput): MaterialApprovalDetailPatch {
  const patch: MaterialApprovalDetailPatch = {};
  if (input.materialName !== undefined) patch.material_name = input.materialName;
  if (input.specification !== undefined) patch.specification = input.specification;
  if (input.quantity !== undefined) patch.quantity = input.quantity;
  if (input.unit !== undefined) patch.unit = input.unit;
  if (input.supplier !== undefined) patch.supplier = input.supplier;
  if (input.neededBy !== undefined) patch.needed_by = input.neededBy;
  if (input.phaseId !== undefined) patch.phase_id = input.phaseId;
  if (input.activityId !== undefined) patch.activity_id = input.activityId;
  return patch;
}

export function materialApprovalsService(
  repository: MaterialApprovalsRepository,
  deps: ApprovalsDeps = {},
) {
  async function hydrate(rows: ApprovalRow[]): Promise<MaterialApproval[]> {
    const ids = rows.map((r) => r.id);
    const [details, counts] = await Promise.all([
      repository.detailsFor(ids),
      repository.commentCounts(ids),
    ]);
    return rows.map((r) => toMaterialApproval(r, details.get(r.id), counts.get(r.id) ?? 0));
  }

  async function requireRow(projectId: string, approvalId: string): Promise<ApprovalRow> {
    const row = await repository.findById(approvalId);
    if (!row || row.project_id !== projectId) throw new NotFoundError("Material approval");
    return row;
  }

  return {
    async list(projectId: string, status?: MaterialApproval["status"]): Promise<MaterialApproval[]> {
      return hydrate(await repository.listByProject(projectId, status));
    },

    async get(projectId: string, approvalId: string): Promise<MaterialApprovalDetail> {
      const row = await requireRow(projectId, approvalId);
      const [details, comments] = await Promise.all([
        repository.detailsFor([row.id]),
        repository.listComments(row.id),
      ]);
      return {
        ...toMaterialApproval(row, details.get(row.id), comments.length),
        comments: comments.map(toComment),
      };
    },

    async create(
      projectId: string,
      input: CreateMaterialApprovalInput,
      userId: string,
    ): Promise<MaterialApproval> {
      const id = generateId("apr");
      const row = await repository.create(
        {
          id,
          project_id: projectId,
          title: input.title,
          description: input.description ?? null,
          description_html: input.descriptionHtml ?? null,
          status: "Pending",
          due_date: input.dueDate ?? null,
          submitted_by_id: userId,
          requested_reviewer_id: input.requestedReviewerId ?? null,
          document_id: input.documentId ?? null,
          document_version_id: input.documentVersionId ?? null,
        },
        {
          approval_id: id,
          material_name: input.materialName,
          specification: input.specification ?? null,
          quantity: input.quantity ?? 0,
          unit: input.unit ?? "item",
          supplier: input.supplier ?? null,
          needed_by: input.neededBy ?? null,
          phase_id: input.phaseId ?? null,
          activity_id: input.activityId ?? null,
        },
      );
      notifyApprovalReviewer(deps, row.requested_reviewer_id, projectId, row.title, userId);
      const [created] = await hydrate([row]);
      if (!created) throw new NotFoundError("Material approval");
      return created;
    },

    async update(
      projectId: string,
      approvalId: string,
      input: UpdateMaterialApprovalInput,
      userId: string,
    ): Promise<MaterialApproval> {
      const existing = await requireRow(projectId, approvalId);

      const patch: ApprovalUpdatePatch = { updated_at: new Date().toISOString() };
      if (input.title !== undefined) patch.title = input.title;
      if (input.description !== undefined) patch.description = input.description;
      if (input.descriptionHtml !== undefined) patch.description_html = input.descriptionHtml;
      if (input.response !== undefined) patch.response = input.response;
      if (input.responseHtml !== undefined) patch.response_html = input.responseHtml;
      if (input.dueDate !== undefined) patch.due_date = input.dueDate;
      if (input.requestedReviewerId !== undefined) {
        patch.requested_reviewer_id = input.requestedReviewerId;
        if (
          input.requestedReviewerId &&
          input.requestedReviewerId !== existing.requested_reviewer_id
        ) {
          notifyApprovalReviewer(
            deps,
            input.requestedReviewerId,
            projectId,
            input.title ?? existing.title,
            userId,
          );
        }
      }

      if (input.status !== undefined) {
        patch.status = input.status;
        if (
          DECISION_STATUSES.includes(input.status) &&
          !DECISION_STATUSES.includes(existing.status)
        ) {
          patch.reviewed_at = new Date().toISOString();
          patch.reviewed_by_id = userId;
          notifyApprovalDecided(
            deps,
            existing.submitted_by_id,
            projectId,
            existing.title,
            input.status,
            userId,
          );
        } else if (input.status === "Pending") {
          patch.reviewed_at = null;
          patch.reviewed_by_id = null;
          if (existing.status !== "Pending") {
            patch.reminder_level = null;
            patch.last_reminded_at = null;
          }
        }
      }

      const updated = await repository.update(approvalId, patch, detailPatchFrom(input));
      if (!updated) throw new NotFoundError("Material approval");
      const [result] = await hydrate([updated]);
      if (!result) throw new NotFoundError("Material approval");
      return result;
    },

    async remove(projectId: string, approvalId: string): Promise<void> {
      await requireRow(projectId, approvalId);
      await repository.remove(approvalId);
    },

    async addComment(
      projectId: string,
      approvalId: string,
      body: string,
      author: { id: string; name: string },
    ): Promise<ApprovalComment> {
      await requireRow(projectId, approvalId);
      const row = await repository.addComment({
        id: generateId("aprc"),
        approval_id: approvalId,
        author_id: author.id,
        author_name: author.name,
        body,
        created_at: new Date().toISOString(),
      });
      return toComment(row);
    },
  };
}

export type MaterialApprovalsService = ReturnType<typeof materialApprovalsService>;
