import { NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { ActionItemsRepository, ActionItemUpdatePatch } from "./repository.ts";
import type {
  ActionComment,
  ActionCommentRow,
  ActionItem,
  ActionItemDetail,
  ActionItemRow,
  ActionPriority,
  ActionStatus,
} from "./types.ts";

export interface CreateActionItemInput {
  title: string;
  description?: string | null;
  status?: ActionStatus;
  priority?: ActionPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export interface UpdateActionItemInput {
  title?: string;
  description?: string | null;
  status?: ActionStatus;
  priority?: ActionPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
}

function toItem(row: ActionItemRow, commentCount: number): ActionItem {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    dueDate: row.due_date,
    resolvedAt: row.resolved_at,
    commentCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toComment(row: ActionCommentRow): ActionComment {
  return {
    id: row.id,
    actionItemId: row.action_item_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

export function actionItemsService(repository: ActionItemsRepository) {
  return {
    async list(projectId: string, status?: ActionStatus): Promise<ActionItem[]> {
      const rows = await repository.listByProject(projectId, status);
      const counts = await repository.commentCounts(rows.map((r) => r.id));
      return rows.map((r) => toItem(r, counts.get(r.id) ?? 0));
    },

    async get(projectId: string, itemId: string): Promise<ActionItemDetail> {
      const row = await repository.findById(itemId);
      if (!row || row.project_id !== projectId) throw new NotFoundError("Action item");
      const comments = await repository.listComments(itemId);
      return { ...toItem(row, comments.length), comments: comments.map(toComment) };
    },

    async create(
      projectId: string,
      input: CreateActionItemInput,
      userId: string,
    ): Promise<ActionItem> {
      const status = input.status ?? "Open";
      const row = await repository.create({
        id: generateId("ai"),
        project_id: projectId,
        title: input.title,
        description: input.description ?? null,
        status,
        priority: input.priority ?? "Medium",
        assignee_id: input.assigneeId ?? null,
        due_date: input.dueDate ?? null,
        created_by_id: userId,
      });
      // resolved_at if created already resolved
      if (status === "Resolved") {
        const updated = await repository.update(row.id, { resolved_at: new Date().toISOString() });
        return toItem(updated ?? row, 0);
      }
      return toItem(row, 0);
    },

    async update(
      projectId: string,
      itemId: string,
      input: UpdateActionItemInput,
    ): Promise<ActionItem> {
      const existing = await repository.findById(itemId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Action item");

      const patch: ActionItemUpdatePatch = { updated_at: new Date().toISOString() };
      if (input.title !== undefined) patch.title = input.title;
      if (input.description !== undefined) patch.description = input.description;
      if (input.priority !== undefined) patch.priority = input.priority;
      if (input.assigneeId !== undefined) patch.assignee_id = input.assigneeId;
      if (input.dueDate !== undefined) patch.due_date = input.dueDate;
      if (input.status !== undefined) {
        patch.status = input.status;
        if (input.status === "Resolved" && existing.status !== "Resolved") {
          patch.resolved_at = new Date().toISOString();
        } else if (input.status !== "Resolved" && existing.status === "Resolved") {
          patch.resolved_at = null;
        }
      }

      const updated = await repository.update(itemId, patch);
      if (!updated) throw new NotFoundError("Action item");
      const counts = await repository.commentCounts([itemId]);
      return toItem(updated, counts.get(itemId) ?? 0);
    },

    async remove(projectId: string, itemId: string): Promise<void> {
      const existing = await repository.findById(itemId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Action item");
      await repository.remove(itemId);
    },

    async addComment(
      projectId: string,
      itemId: string,
      body: string,
      author: { id: string; name: string },
    ): Promise<ActionComment> {
      const existing = await repository.findById(itemId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Action item");
      const row = await repository.addComment({
        id: generateId("aic"),
        action_item_id: itemId,
        author_id: author.id,
        author_name: author.name,
        body,
        created_at: new Date().toISOString(),
      });
      return toComment(row);
    },
  };
}

export type ActionItemsService = ReturnType<typeof actionItemsService>;
