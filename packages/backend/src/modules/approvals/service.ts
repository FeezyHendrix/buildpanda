import { NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { ApprovalsRepository, ApprovalUpdatePatch } from "./repository.ts";
import type {
  Approval,
  ApprovalComment,
  ApprovalCommentRow,
  ApprovalDetail,
  ApprovalRow,
  ApprovalStatus,
} from "./types.ts";

export interface CreateApprovalInput {
  title: string;
  category?: string | null;
  description?: string | null;
  dueDate?: string | null;
}

export interface UpdateApprovalInput {
  title?: string;
  category?: string | null;
  description?: string | null;
  status?: ApprovalStatus;
  response?: string | null;
  dueDate?: string | null;
}

const DECISIONS: ApprovalStatus[] = ["Approved", "Rejected", "Resubmit"];

function toApproval(row: ApprovalRow, commentCount: number): Approval {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    category: row.category,
    description: row.description,
    status: row.status,
    response: row.response,
    dueDate: row.due_date,
    submittedById: row.submitted_by_id,
    reviewedById: row.reviewed_by_id,
    reviewedByName: row.reviewed_by_name,
    reviewedAt: row.reviewed_at,
    commentCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

export function approvalsService(repository: ApprovalsRepository) {
  return {
    async list(projectId: string, status?: ApprovalStatus): Promise<Approval[]> {
      const rows = await repository.listByProject(projectId, status);
      const counts = await repository.commentCounts(rows.map((r) => r.id));
      return rows.map((r) => toApproval(r, counts.get(r.id) ?? 0));
    },

    async get(projectId: string, approvalId: string): Promise<ApprovalDetail> {
      const row = await repository.findById(approvalId);
      if (!row || row.project_id !== projectId) throw new NotFoundError("Approval");
      const comments = await repository.listComments(approvalId);
      return { ...toApproval(row, comments.length), comments: comments.map(toComment) };
    },

    async create(projectId: string, input: CreateApprovalInput, userId: string): Promise<Approval> {
      const row = await repository.create({
        id: generateId("apr"),
        project_id: projectId,
        title: input.title,
        category: input.category ?? null,
        description: input.description ?? null,
        status: "Pending",
        due_date: input.dueDate ?? null,
        submitted_by_id: userId,
      });
      return toApproval(row, 0);
    },

    async update(
      projectId: string,
      approvalId: string,
      input: UpdateApprovalInput,
      userId: string,
    ): Promise<Approval> {
      const existing = await repository.findById(approvalId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Approval");

      const patch: ApprovalUpdatePatch = { updated_at: new Date().toISOString() };
      if (input.title !== undefined) patch.title = input.title;
      if (input.category !== undefined) patch.category = input.category;
      if (input.description !== undefined) patch.description = input.description;
      if (input.response !== undefined) patch.response = input.response;
      if (input.dueDate !== undefined) patch.due_date = input.dueDate;

      if (input.status !== undefined) {
        patch.status = input.status;
        // Stamp the reviewer when a decision is made; clear when reset to Pending.
        if (DECISIONS.includes(input.status) && !DECISIONS.includes(existing.status)) {
          patch.reviewed_at = new Date().toISOString();
          patch.reviewed_by_id = userId;
        } else if (input.status === "Pending") {
          patch.reviewed_at = null;
          patch.reviewed_by_id = null;
        }
      }

      const updated = await repository.update(approvalId, patch);
      if (!updated) throw new NotFoundError("Approval");
      const counts = await repository.commentCounts([approvalId]);
      return toApproval(updated, counts.get(approvalId) ?? 0);
    },

    async remove(projectId: string, approvalId: string): Promise<void> {
      const existing = await repository.findById(approvalId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Approval");
      await repository.remove(approvalId);
    },

    async addComment(
      projectId: string,
      approvalId: string,
      body: string,
      author: { id: string; name: string },
    ): Promise<ApprovalComment> {
      const existing = await repository.findById(approvalId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Approval");
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

export type ApprovalsService = ReturnType<typeof approvalsService>;
