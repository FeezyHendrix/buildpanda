import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { NotificationsService } from "../notifications/service.ts";
import type { ChangeRequestsRepository, ChangeRequestUpdatePatch } from "./repository.ts";
import type {
  ChangeBudgetLink,
  ChangeComment,
  ChangeCommentRow,
  ChangeRequest,
  ChangeRequestDetail,
  ChangeRequestRow,
  ChangeStatus,
  Currency,
} from "./types.ts";

export interface CreateChangeRequestInput {
  title: string;
  description?: string | null;
  descriptionHtml?: string | null;
  reason?: string | null;
  reasonHtml?: string | null;
  costImpact?: number;
  timeImpactDays?: number;
  currency?: Currency;
  assigneeId?: string | null;
}

export interface UpdateChangeRequestInput {
  title?: string;
  description?: string | null;
  descriptionHtml?: string | null;
  reason?: string | null;
  reasonHtml?: string | null;
  status?: ChangeStatus;
  costImpact?: number;
  timeImpactDays?: number;
  currency?: Currency;
  assigneeId?: string | null;
}

export interface ChangeRequestsDeps {
  notifications?: NotificationsService;
}

const DECISIONS: ChangeStatus[] = ["Approved", "Rejected"];

function notifyChangeAssignee(
  deps: ChangeRequestsDeps,
  assigneeId: string | null | undefined,
  projectId: string,
  title: string,
  actorId: string,
): void {
  if (!deps.notifications || !assigneeId || assigneeId === actorId) return;
  void deps.notifications
    .notify(assigneeId, "change_request_assigned", {
      title: "A change request was assigned to you",
      body: title,
      projectId,
    })
    .catch(() => undefined);
}

function notifyChangeDecided(
  deps: ChangeRequestsDeps,
  submitterId: string | null | undefined,
  projectId: string,
  title: string,
  status: string,
  actorId: string,
): void {
  if (!deps.notifications || !submitterId || submitterId === actorId) return;
  void deps.notifications
    .notify(submitterId, "change_request_decided", {
      title: `Change request ${status.toLowerCase()}`,
      body: title,
      projectId,
    })
    .catch(() => undefined);
}

function toChange(row: ChangeRequestRow, commentCount: number): ChangeRequest {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    descriptionHtml: row.description_html,
      reason: row.reason,
      reasonHtml: row.reason_html,
      status: row.status,
    costImpact: Number(row.cost_impact),
    timeImpactDays: row.time_impact_days,
    currency: row.currency,
    submittedById: row.submitted_by_id,
    decidedById: row.decided_by_id,
    decidedByName: row.decided_by_name,
    decidedAt: row.decided_at,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    commentCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toComment(row: ChangeCommentRow): ChangeComment {
  return {
    id: row.id,
    changeRequestId: row.change_request_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

export function changeRequestsService(
  repository: ChangeRequestsRepository,
  deps: ChangeRequestsDeps = {},
) {
  return {
    async list(projectId: string, status?: ChangeStatus): Promise<ChangeRequest[]> {
      const rows = await repository.listByProject(projectId, status);
      const counts = await repository.commentCounts(rows.map((r) => r.id));
      return rows.map((r) => toChange(r, counts.get(r.id) ?? 0));
    },

    async get(projectId: string, id: string): Promise<ChangeRequestDetail> {
      const row = await repository.findById(id);
      if (!row || row.project_id !== projectId) throw new NotFoundError("Change request");
      const comments = await repository.listComments(id);
      return { ...toChange(row, comments.length), comments: comments.map(toComment) };
    },

    async create(projectId: string, input: CreateChangeRequestInput, userId: string): Promise<ChangeRequest> {
      const row = await repository.create({
        id: generateId("chg"),
        project_id: projectId,
        title: input.title,
        description: input.description ?? null,
        description_html: input.descriptionHtml ?? null,
        reason: input.reason ?? null,
        reason_html: input.reasonHtml ?? null,
        status: "Draft",
        cost_impact: String(input.costImpact ?? 0),
        time_impact_days: input.timeImpactDays ?? 0,
        currency: input.currency ?? "NGN",
        submitted_by_id: userId,
        assignee_id: input.assigneeId ?? null,
      });
      notifyChangeAssignee(deps, row.assignee_id, projectId, row.title, userId);
      return toChange(row, 0);
    },

    async update(
      projectId: string,
      id: string,
      input: UpdateChangeRequestInput,
      userId: string,
    ): Promise<ChangeRequest> {
      const existing = await repository.findById(id);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Change request");

      const patch: ChangeRequestUpdatePatch = { updated_at: new Date().toISOString() };
      if (input.title !== undefined) patch.title = input.title;
      if (input.description !== undefined) patch.description = input.description;
      if (input.descriptionHtml !== undefined) patch.description_html = input.descriptionHtml;
      if (input.reason !== undefined) patch.reason = input.reason;
      if (input.reasonHtml !== undefined) patch.reason_html = input.reasonHtml;
      if (input.costImpact !== undefined) patch.cost_impact = String(input.costImpact);
      if (input.timeImpactDays !== undefined) patch.time_impact_days = input.timeImpactDays;
      if (input.currency !== undefined) patch.currency = input.currency;
      if (input.status !== undefined) {
        patch.status = input.status;
        if (DECISIONS.includes(input.status) && !DECISIONS.includes(existing.status)) {
          patch.decided_at = new Date().toISOString();
          patch.decided_by_id = userId;
          notifyChangeDecided(deps, existing.submitted_by_id, projectId, existing.title, input.status, userId);
        } else if (!DECISIONS.includes(input.status)) {
          patch.decided_at = null;
          patch.decided_by_id = null;
        }
      }

      const reassigned =
        input.assigneeId !== undefined && input.assigneeId !== existing.assignee_id;
      if (input.assigneeId !== undefined) patch.assignee_id = input.assigneeId;

      const updated = await repository.update(id, patch);
      if (!updated) throw new NotFoundError("Change request");
      if (reassigned) {
        notifyChangeAssignee(deps, updated.assignee_id, projectId, updated.title, userId);
      }
      const counts = await repository.commentCounts([id]);
      return toChange(updated, counts.get(id) ?? 0);
    },

    async remove(projectId: string, id: string): Promise<void> {
      const existing = await repository.findById(id);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Change request");
      await repository.remove(id);
    },

    async addComment(
      projectId: string,
      id: string,
      body: string,
      author: { id: string; name: string },
    ): Promise<ChangeComment> {
      const existing = await repository.findById(id);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Change request");
      const row = await repository.addComment({
        id: generateId("chgc"),
        change_request_id: id,
        author_id: author.id,
        author_name: author.name,
        body,
        created_at: new Date().toISOString(),
      });
      return toComment(row);
    },

    async getBudgetLinks(projectId: string, id: string): Promise<ChangeBudgetLink[]> {
      const existing = await repository.findById(id);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Change request");
      const rows = await repository.listBudgetLinks(id);
      return rows.map((r) => ({
        budgetCategoryId: r.budget_category_id,
        amount: Number(r.amount),
        committed: r.committed,
      }));
    },

    async setBudgetLinks(
      projectId: string,
      id: string,
      links: ChangeBudgetLink[],
    ): Promise<ChangeBudgetLink[]> {
      const existing = await repository.findById(id);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Change request");
      const total = links.reduce((sum, l) => sum + l.amount, 0);
      const costImpact = Number(existing.cost_impact);
      if (total > costImpact + 0.01) {
        throw new BadRequestError(
          "Allocated amount exceeds the change request cost impact",
        );
      }
      await repository.replaceBudgetLinks(
        id,
        links.map((l) => ({
          id: generateId("crbl"),
          change_request_id: id,
          budget_category_id: l.budgetCategoryId,
          amount: String(l.amount),
          committed: l.committed,
        })),
      );
      return this.getBudgetLinks(projectId, id);
    },
  };
}

export type ChangeRequestsService = ReturnType<typeof changeRequestsService>;
