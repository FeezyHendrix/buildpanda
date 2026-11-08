import { config } from "../../config/index.ts";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { approvalAttachments, type AttachmentPick } from "./attachments.ts";
import { approvalCategories, approverRules } from "./approvers.ts";
import { type ApprovalsDeps, notifyApprovalDecided, notifyApprovalRequested } from "./notify.ts";
import type { ApprovalsRepository, ApprovalUpdatePatch, AttachmentWithFile } from "./repository.ts";
import {
  DECISION_STATUSES,
  type Approval,
  type ApprovalAttachment,
  type ApprovalComment,
  type ApprovalCommentRow,
  type ApprovalDecision,
  type ApprovalDecisionRow,
  type ApprovalDetail,
  type ApprovalListQuery,
  type ApprovalPage,
  type ApprovalRevision,
  type ApprovalRow,
  type ApprovalStatus,
  type ApprovalViewer,
} from "./types.ts";

export type { ApprovalsDeps };

export interface ApprovalProject {
  id: string;
  ownerId: string | null;
  organizationId: string | null;
  startDate: string | null;
}

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
  attachments?: AttachmentPick[];
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

export interface ResubmitApprovalInput {
  description?: string | null;
  descriptionHtml?: string | null;
  attachments?: AttachmentPick[];
}

// The list shows this many chips and a "+N" for the rest.
const LIST_ATTACHMENTS = 3;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const SETTLED: readonly ApprovalStatus[] = ["Approved", "Rejected"];
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const fieldError = (field: string, message: string) => new ValidationError(message, { fields: { [field]: message } });

function viewerCanDecide(row: ApprovalRow, viewer: ApprovalViewer): boolean {
  return viewer.canDecide && (!row.requested_reviewer_id || row.requested_reviewer_id === viewer.id);
}

function toApproval(row: ApprovalRow, commentCount: number, viewer: ApprovalViewer, attachments: ApprovalAttachment[], attachmentCount: number): Approval {
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
    revision: row.revision,
    commentCount,
    attachments,
    attachmentCount,
    viewerCanDecide: viewerCanDecide(row, viewer),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toComment(row: ApprovalCommentRow): ApprovalComment {
  return { id: row.id, approvalId: row.approval_id, authorId: row.author_id, authorName: row.author_name, body: row.body, createdAt: row.created_at };
}

function toDecision(row: ApprovalDecisionRow): ApprovalDecision {
  return {
    id: row.id,
    decision: row.decision,
    note: row.note,
    noteHtml: row.note_html,
    actorId: row.actor_id,
    actorName: row.actor_name ?? null,
    decidedAt: row.decided_at,
    revision: row.revision,
  };
}

function decisionRow(approvalId: string, decision: ApprovalStatus, note: string | null, noteHtml: string | null, actorId: string, revision: number): ApprovalDecisionRow {
  return { id: generateId("aprd"), approval_id: approvalId, decision, note, note_html: noteHtml, actor_id: actorId, decided_at: new Date().toISOString(), revision };
}

export function approvalsService(repository: ApprovalsRepository, deps: ApprovalsDeps = {}) {
  const files = approvalAttachments(repository, deps);
  const { approvers, reviewerOrDeciders } = approverRules(repository);

  async function found(projectId: string, approvalId: string): Promise<ApprovalRow> {
    const row = await repository.findById(approvalId);
    if (!row || row.project_id !== projectId) throw new NotFoundError("Approval");
    return row;
  }

  async function present(rows: ApprovalRow[], viewer: ApprovalViewer, limit: number): Promise<Approval[]> {
    const ids = rows.map((r) => r.id);
    const [counts, attachments] = await Promise.all([repository.commentCounts(ids), files.rowsFor(ids)]);
    return Promise.all(
      rows.map(async (r) => {
        const a = await files.current(attachments.get(r.id), r.revision, viewer.canOpenFiles, limit);
        return toApproval(r, counts.get(r.id) ?? 0, viewer, a.attachments, a.count);
      }),
    );
  }

  function checkDueDate(dueDate: string | null | undefined, project: ApprovalProject): void {
    if (!dueDate) return;
    const day = dueDate.slice(0, 10);
    if (!ISO_DAY.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) throw fieldError("dueDate", "Use a date in yyyy-mm-dd form");
    if (project.startDate && day < project.startDate.slice(0, 10)) throw fieldError("dueDate", "The decision date is before the project starts");
  }

  async function revisions(row: ApprovalRow, rows: AttachmentWithFile[], decisions: ApprovalDecisionRow[], viewer: ApprovalViewer): Promise<ApprovalRevision[]> {
    const out: ApprovalRevision[] = [];
    for (let revision = 1; revision <= row.revision; revision += 1) {
      const submitted = revision === 1 ? row.created_at : decisions.find((d) => d.revision === revision && d.decision === "Pending")?.decided_at;
      const decided = [...decisions].reverse().find((d) => d.revision === revision && d.decision !== "Pending");
      out.push({
        revision,
        submittedAt: submitted ?? row.created_at,
        attachments: await files.present(rows.filter((a) => a.revision === revision), viewer.canOpenFiles),
        decision: decided?.decision ?? null,
        decisionNote: decided?.note ?? null,
      });
    }
    return out;
  }

  return {
    approvers,

    async list(projectId: string, viewer: ApprovalViewer, status?: ApprovalStatus): Promise<Approval[]> {
      return present(await repository.listByProject(projectId, status), viewer, LIST_ATTACHMENTS);
    },

    async page(projectId: string, query: ApprovalListQuery, viewer: ApprovalViewer): Promise<ApprovalPage> {
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
      const [{ rows, total }, counts] = await Promise.all([
        repository.search(projectId, query, viewer, config.timezone, page, pageSize),
        repository.counts(projectId, viewer),
      ]);
      return { items: await present(rows, viewer, LIST_ATTACHMENTS), total, page, pageSize, counts };
    },

    async get(projectId: string, approvalId: string, viewer: ApprovalViewer): Promise<ApprovalDetail> {
      const row = await found(projectId, approvalId);
      const [comments, attachments, decisions] = await Promise.all([
        repository.listComments(approvalId),
        files.rowsFor([approvalId]),
        repository.listDecisions(approvalId),
      ]);
      const rows = attachments.get(approvalId) ?? [];
      const a = await files.current(rows, row.revision, viewer.canOpenFiles);
      return {
        ...toApproval(row, comments.length, viewer, a.attachments, a.count),
        comments: comments.map(toComment),
        decisions: decisions.map(toDecision),
        revisions: await revisions(row, rows, decisions, viewer),
      };
    },

    async create(project: ApprovalProject, input: CreateApprovalInput, userId: string, viewer: ApprovalViewer): Promise<Approval> {
      const title = input.title.trim();
      if (!title) throw fieldError("title", "Say what needs approval");
      checkDueDate(input.dueDate, project);
      const recipients = await reviewerOrDeciders(project, input.requestedReviewerId);
      const id = generateId("apr");
      const attachments = await files.validate(project.id, id, userId, input.attachments ?? [], 1);
      const row = await repository.create(
        {
          id,
          project_id: project.id,
          title,
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
        },
        attachments,
      );
      const [created] = await present([row], viewer, LIST_ATTACHMENTS);
      notifyApprovalRequested(deps, recipients, project.id, { id, title, dueDate: row.due_date, attachmentCount: created!.attachmentCount }, userId);
      return created!;
    },

    async update(project: ApprovalProject, approvalId: string, input: UpdateApprovalInput, userId: string, viewer: ApprovalViewer): Promise<Approval> {
      const existing = await found(project.id, approvalId);
      const editsRecord = [input.title, input.category, input.description, input.descriptionHtml, input.dueDate, input.requestedReviewerId].some((v) => v !== undefined);
      // A settled approval is a record of what was decided; it is reopened, not rewritten.
      if (editsRecord && SETTLED.includes(existing.status) && input.status !== "Pending") {
        throw new ConflictError("This approval has been decided. Set it back to Pending to change the request.");
      }

      const patch: ApprovalUpdatePatch = { updated_at: new Date().toISOString() };
      if (input.title !== undefined) {
        patch.title = input.title.trim();
        if (!patch.title) throw fieldError("title", "Say what needs approval");
      }
      if (input.category !== undefined) patch.category = input.category;
      if (input.description !== undefined) patch.description = input.description;
      if (input.descriptionHtml !== undefined) patch.description_html = input.descriptionHtml;
      if (input.response !== undefined) patch.response = input.response;
      if (input.responseHtml !== undefined) patch.response_html = input.responseHtml;
      if (input.dueDate !== undefined) {
        checkDueDate(input.dueDate, project);
        patch.due_date = input.dueDate;
      }
      let newReviewer: string[] = [];
      if (input.requestedReviewerId !== undefined) {
        patch.requested_reviewer_id = input.requestedReviewerId;
        if (input.requestedReviewerId && input.requestedReviewerId !== existing.requested_reviewer_id) {
          newReviewer = await reviewerOrDeciders(project, input.requestedReviewerId);
        }
      }

      let decision: ApprovalDecisionRow | undefined;
      if (input.status !== undefined && input.status !== existing.status) {
        // Sending work back without saying why is not a decision anyone can act on.
        const note = input.response !== undefined ? input.response : existing.response;
        if ((input.status === "Rejected" || input.status === "Resubmit") && !note?.trim()) {
          throw fieldError("response", "A note is required to reject or request changes");
        }
        patch.status = input.status;
        const noteHtml = input.responseHtml !== undefined ? input.responseHtml : existing.response_html;
        decision = decisionRow(approvalId, input.status, note ?? null, noteHtml ?? null, userId, existing.revision);
        if (DECISION_STATUSES.includes(input.status)) {
          patch.reviewed_at = decision.decided_at;
          patch.reviewed_by_id = userId;
          notifyApprovalDecided(deps, existing.submitted_by_id, project.id, existing.title, input.status, userId, existing.id);
        } else {
          // Back to Pending: clear the decision stamp and restart decision chasing from level one.
          patch.reviewed_at = null;
          patch.reviewed_by_id = null;
          patch.reminder_level = null;
          patch.last_reminded_at = null;
        }
      }

      const updated = await repository.update(approvalId, patch, decision);
      if (!updated) throw new NotFoundError("Approval");
      const [result] = await present([updated], viewer, LIST_ATTACHMENTS);
      if (newReviewer.length > 0) {
        notifyApprovalRequested(deps, newReviewer, project.id, { id: updated.id, title: updated.title, dueDate: updated.due_date, attachmentCount: result!.attachmentCount }, userId);
      }
      return result!;
    },

    /** The requester answers "changes requested" with a new revision; the reviewer gets it again. */
    async resubmit(project: ApprovalProject, approvalId: string, input: ResubmitApprovalInput, userId: string, viewer: ApprovalViewer): Promise<Approval> {
      const existing = await found(project.id, approvalId);
      if (existing.submitted_by_id !== userId) throw new ForbiddenError("Only the requester can resubmit this approval");
      if (existing.status !== "Resubmit") throw new ConflictError("Only an approval with changes requested can be resubmitted");
      const revision = existing.revision + 1;
      let attachments = await files.validate(project.id, approvalId, userId, input.attachments ?? [], revision);
      if (input.attachments === undefined) {
        // Nothing said about files: the previous revision's set carries forward.
        const previous = ((await files.rowsFor([approvalId])).get(approvalId) ?? []).filter((a) => a.revision === existing.revision);
        attachments = previous.map((a) => ({ ...a, id: generateId("apra"), revision, created_by: userId, created_at: new Date().toISOString(), file: undefined, current_version_id: undefined }) as never);
      }
      const patch: ApprovalUpdatePatch = {
        status: "Pending",
        revision,
        response: null,
        response_html: null,
        reviewed_at: null,
        reviewed_by_id: null,
        reminder_level: null,
        last_reminded_at: null,
        updated_at: new Date().toISOString(),
      };
      if (input.description !== undefined) patch.description = input.description;
      if (input.descriptionHtml !== undefined) patch.description_html = input.descriptionHtml;
      const updated = await repository.resubmit(approvalId, patch, attachments, decisionRow(approvalId, "Pending", null, null, userId, revision));
      if (!updated) throw new NotFoundError("Approval");
      const [result] = await present([updated], viewer, LIST_ATTACHMENTS);
      const recipients = await reviewerOrDeciders(project, updated.requested_reviewer_id);
      notifyApprovalRequested(deps, recipients, project.id, { id: updated.id, title: updated.title, dueDate: updated.due_date, attachmentCount: result!.attachmentCount, resubmitted: true }, userId);
      return result!;
    },

    /** Add or remove files while the request is still Pending; a decided revision is never rewritten. */
    async changeAttachments(project: ApprovalProject, approvalId: string, change: { add?: AttachmentPick[]; remove?: string[] }, userId: string, viewer: ApprovalViewer): Promise<Approval> {
      const existing = await found(project.id, approvalId);
      if (existing.status !== "Pending") throw new ConflictError("Attachments can only change while the approval is pending");
      const current = ((await files.rowsFor([approvalId])).get(approvalId) ?? []).filter((a) => a.revision === existing.revision);
      const remove = (change.remove ?? []).filter((id) => current.some((a) => a.id === id));
      const kept = current.length - remove.length;
      const added = await files.validate(project.id, approvalId, userId, change.add ?? [], existing.revision);
      if (kept + added.length > 5) throw fieldError("attachments", "At most 5 attachments per request");
      added.forEach((a, i) => (a.position = kept + i));
      await repository.removeAttachments(approvalId, remove);
      await repository.addAttachments(added);
      const [result] = await present([existing], viewer, LIST_ATTACHMENTS);
      return result!;
    },

    async remove(projectId: string, approvalId: string): Promise<void> {
      const existing = await found(projectId, approvalId);
      if (SETTLED.includes(existing.status)) throw new ConflictError("A decided approval is a record and cannot be deleted");
      await repository.remove(approvalId);
    },

    async addComment(projectId: string, approvalId: string, body: string, author: { id: string; name: string }): Promise<ApprovalComment> {
      await found(projectId, approvalId);
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

    categories: (projectId: string) => approvalCategories(repository).list(projectId),
    replaceCategories: (projectId: string, names: string[]) => approvalCategories(repository).replace(projectId, names),
  };
}

export type ApprovalsService = ReturnType<typeof approvalsService>;
