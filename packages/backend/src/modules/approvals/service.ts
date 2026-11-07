import { NotFoundError, ValidationError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import {
  type ApprovalsDeps,
  notifyApprovalDecided,
  notifyApprovalReviewer,
} from "./notify.ts";
import type { ApprovalsRepository, ApprovalUpdatePatch } from "./repository.ts";
import {
  DECISION_STATUSES,
  type Approval,
  type ApprovalAttachment,
  type ApprovalAttachmentRow,
  type ApprovalComment,
  type ApprovalCommentRow,
  type ApprovalDetail,
  type ApprovalRow,
  type ApprovalStatus,
} from "./types.ts";

export type { ApprovalsDeps };

export interface CreateApprovalInput {
  title: string;
  category?: string | null;
  description?: string | null;
  descriptionHtml?: string | null;
  dueDate?: string | null;
  requestedReviewerId?: string | null;
  documentId?: string | null;
  documentVersionId?: string | null;
  sourceMarkupId?: string | null;
  attachments?: { fileId: string }[];
}

export interface UpdateApprovalInput {
  title?: string;
  category?: string | null;
  description?: string | null;
  descriptionHtml?: string | null;
  status?: ApprovalStatus;
  response?: string | null;
  responseHtml?: string | null;
  dueDate?: string | null;
  requestedReviewerId?: string | null;
}

// What the form may attach (docs/approval-request-form-backend.md §2.2).
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_MIME_TYPES = new Set(["image/png", "image/jpeg", "application/pdf"]);
// The list shows this many chips and a "+N" for the rest.
const LIST_ATTACHMENTS = 3;

type AttachmentRows = Awaited<ReturnType<ApprovalsRepository["listAttachments"]>>;

function toApproval(row: ApprovalRow, commentCount: number, attachments: ApprovalAttachment[] = [], attachmentCount = attachments.length): Approval {
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
    attachments,
    attachmentCount,
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

export function approvalsService(repository: ApprovalsRepository, deps: ApprovalsDeps = {}) {
  async function presign(rows: AttachmentRows): Promise<ApprovalAttachment[]> {
    return Promise.all(
      rows.map(async (a) => ({
        id: a.id,
        fileName: a.file.file_name,
        mimeType: a.file.mime_type,
        sizeBytes: Number(a.file.size_bytes),
        url: deps.files ? await deps.files.presignViewUrl(a.file) : "",
      })),
    );
  }

  // Attachments for a page of approvals in one query, capped per approval for the list.
  async function attachmentsFor(approvalIds: string[], limit = Infinity) {
    const rows = await repository.listAttachments(approvalIds);
    const byApproval = new Map<string, AttachmentRows>();
    for (const r of rows) byApproval.set(r.approval_id, [...(byApproval.get(r.approval_id) ?? []), r]);
    const out = new Map<string, { attachments: ApprovalAttachment[]; count: number }>();
    for (const [id, list] of byApproval) {
      out.set(id, { attachments: await presign(list.slice(0, limit)), count: list.length });
    }
    return out;
  }

  // The UI checks are convenience; this is the rule. Errors name the file.
  async function attachmentRows(
    projectId: string,
    approvalId: string,
    userId: string,
    picked: { fileId: string }[],
  ): Promise<ApprovalAttachmentRow[]> {
    if (picked.length === 0) return [];
    const fields = (attachments: string) => ({ fields: { attachments } });
    if (picked.length > MAX_ATTACHMENTS) {
      throw new ValidationError(`At most ${MAX_ATTACHMENTS} attachments per request`, fields("too_many"));
    }
    const ids = picked.map((p) => p.fileId);
    if (new Set(ids).size !== ids.length) throw new ValidationError("The same file is attached twice", fields("duplicate"));
    if (!deps.files) throw new ValidationError("File upload is not switched on for approvals", fields("unavailable"));
    const files = new Map((await deps.files.findRows(ids)).map((f) => [f.id, f]));
    const taken = new Set(await repository.attachedFileIds(ids));
    const now = new Date().toISOString();
    return ids.map((fileId, position) => {
      const f = files.get(fileId);
      if (!f || f.project_id !== projectId || f.owner_id !== userId) {
        throw new ValidationError("That file is not one you uploaded to this project", fields(fileId));
      }
      // shortcut: trusts the mime type recorded at upload, sniff the bytes if a mislabelled file ever gets through.
      if (!ATTACHMENT_MIME_TYPES.has(f.mime_type)) {
        throw new ValidationError(`${f.file_name}: only PNG, JPG or PDF files can be attached`, fields(fileId));
      }
      if (Number(f.size_bytes) > MAX_ATTACHMENT_BYTES) {
        throw new ValidationError(`${f.file_name}: attachments must be 10 MB or smaller`, fields(fileId));
      }
      if (taken.has(fileId)) throw new ValidationError(`${f.file_name} is already attached to another request`, fields(fileId));
      return { id: generateId("apra"), approval_id: approvalId, file_id: fileId, position, created_by: userId, created_at: now };
    });
  }

  return {
    async list(projectId: string, status?: ApprovalStatus): Promise<Approval[]> {
      const rows = await repository.listByProject(projectId, status);
      const ids = rows.map((r) => r.id);
      const [counts, attachments] = await Promise.all([repository.commentCounts(ids), attachmentsFor(ids, LIST_ATTACHMENTS)]);
      return rows.map((r) => {
        const a = attachments.get(r.id);
        return toApproval(r, counts.get(r.id) ?? 0, a?.attachments, a?.count);
      });
    },

    async get(projectId: string, approvalId: string): Promise<ApprovalDetail> {
      const row = await repository.findById(approvalId);
      if (!row || row.project_id !== projectId) throw new NotFoundError("Approval");
      const [comments, attachments] = await Promise.all([repository.listComments(approvalId), attachmentsFor([approvalId])]);
      const a = attachments.get(approvalId);
      return { ...toApproval(row, comments.length, a?.attachments, a?.count), comments: comments.map(toComment) };
    },

    async create(projectId: string, input: CreateApprovalInput, userId: string): Promise<Approval> {
      const id = generateId("apr");
      const attachments = await attachmentRows(projectId, id, userId, input.attachments ?? []);
      const row = await repository.create({
        id,
        project_id: projectId,
        title: input.title,
        category: input.category ?? null,
        description: input.description ?? null,
        description_html: input.descriptionHtml ?? null,
        status: "Pending",
        due_date: input.dueDate ?? null,
        submitted_by_id: userId,
        requested_reviewer_id: input.requestedReviewerId ?? null,
        document_id: input.documentId ?? null,
        document_version_id: input.documentVersionId ?? null,
        source_markup_id: input.sourceMarkupId ?? null,
      }, attachments);
      notifyApprovalReviewer(deps, row.requested_reviewer_id, projectId, row.title, userId, row.id);
      const a = (await attachmentsFor([id])).get(id);
      return toApproval(row, 0, a?.attachments, a?.count);
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
      if (input.descriptionHtml !== undefined) patch.description_html = input.descriptionHtml;
      if (input.response !== undefined) patch.response = input.response;
      if (input.responseHtml !== undefined) patch.response_html = input.responseHtml;
      if (input.dueDate !== undefined) patch.due_date = input.dueDate;
      if (input.requestedReviewerId !== undefined) {
        patch.requested_reviewer_id = input.requestedReviewerId;
        if (input.requestedReviewerId && input.requestedReviewerId !== existing.requested_reviewer_id) {
          notifyApprovalReviewer(deps, input.requestedReviewerId, projectId, input.title ?? existing.title, userId, existing.id);
        }
      }

      if (input.status !== undefined) {
        // Sending work back without saying why is not a decision anyone can act on.
        const note = input.response !== undefined ? input.response : existing.response;
        if ((input.status === "Rejected" || input.status === "Resubmit") && !note?.trim()) {
          throw new ValidationError("A note is required to reject or request changes", { fields: { response: "required" } });
        }
        patch.status = input.status;
        // Stamp the reviewer when a decision is made; clear when reset to Pending.
        if (
          DECISION_STATUSES.includes(input.status) &&
          !DECISION_STATUSES.includes(existing.status)
        ) {
          patch.reviewed_at = new Date().toISOString();
          patch.reviewed_by_id = userId;
          notifyApprovalDecided(deps, existing.submitted_by_id, projectId, existing.title, input.status, userId, existing.id);
        } else if (input.status === "Pending") {
          patch.reviewed_at = null;
          patch.reviewed_by_id = null;
          if (existing.status !== "Pending") {
            // Reopening restarts decision chasing from level one.
            patch.reminder_level = null;
            patch.last_reminded_at = null;
          }
        }
      }

      const updated = await repository.update(approvalId, patch);
      if (!updated) throw new NotFoundError("Approval");
      const [counts, attachments] = await Promise.all([repository.commentCounts([approvalId]), attachmentsFor([approvalId])]);
      const a = attachments.get(approvalId);
      return toApproval(updated, counts.get(approvalId) ?? 0, a?.attachments, a?.count);
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
