import { NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { NotificationsService } from "../notifications/service.ts";
import type { ActionItemsRepository, ActionItemUpdatePatch } from "./repository.ts";
import type {
  ActionComment,
  ActionCommentRow,
  ActionItem,
  ActionItemDetail,
  ActionItemRow,
  ActionPriority,
  ActionStatus,
  RecurrenceUnit,
} from "./types.ts";

export interface CreateActionItemInput {
  title: string;
  description?: string | null;
  descriptionHtml?: string | null;
  status?: ActionStatus;
  priority?: ActionPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  recurrenceUnit?: RecurrenceUnit | null;
  recurrenceInterval?: number | null;
  recurrenceUntil?: string | null;
}

export interface UpdateActionItemInput {
  title?: string;
  description?: string | null;
  descriptionHtml?: string | null;
  status?: ActionStatus;
  priority?: ActionPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  recurrenceUnit?: RecurrenceUnit | null;
  recurrenceInterval?: number | null;
  recurrenceUntil?: string | null;
}

export interface ActionItemsDeps {
  notifications?: NotificationsService;
}

function toItem(row: ActionItemRow, commentCount: number): ActionItem {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    descriptionHtml: row.description_html,
    status: row.status,
    priority: row.priority,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    dueDate: row.due_date,
    resolvedAt: row.resolved_at,
    recurrenceUnit: row.recur_unit,
    recurrenceInterval: row.recur_interval,
    recurrenceUntil: row.recur_until,
    recurrenceParentId: row.recur_parent_id,
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

function toDateString(value: string | null): string | null {
  return value ? new Date(value).toISOString().slice(0, 10) : null;
}

function computeNextDue(from: string | null, unit: RecurrenceUnit, interval: number): string {
  const base = from ? new Date(from) : new Date();
  const step = interval >= 1 ? interval : 1;
  if (unit === "day") base.setUTCDate(base.getUTCDate() + step);
  else if (unit === "week") base.setUTCDate(base.getUTCDate() + step * 7);
  else base.setUTCMonth(base.getUTCMonth() + step);
  return base.toISOString().slice(0, 10);
}

async function spawnNextOccurrence(
  repository: ActionItemsRepository,
  origin: ActionItemRow,
): Promise<void> {
  if (!origin.recur_unit) return;
  const nextDue = computeNextDue(origin.due_date, origin.recur_unit, origin.recur_interval ?? 1);
  const until = toDateString(origin.recur_until);
  if (until && nextDue > until) return;

  await repository.create({
    id: generateId("ai"),
    project_id: origin.project_id,
    title: origin.title,
    description: origin.description,
    description_html: origin.description_html,
    status: "Open",
    priority: origin.priority,
    assignee_id: origin.assignee_id,
    due_date: nextDue,
    created_by_id: origin.created_by_id,
    recur_unit: origin.recur_unit,
    recur_interval: origin.recur_interval,
    recur_until: origin.recur_until,
    recur_parent_id: origin.recur_parent_id ?? origin.id,
  });
}

function notifyAssignee(
  deps: ActionItemsDeps,
  row: ActionItemRow,
  actorId: string,
  title: string,
): void {
  if (!deps.notifications || !row.assignee_id || row.assignee_id === actorId) return;
  void deps.notifications
    .notify(row.assignee_id, "action_item_assigned", {
      title: "New action item assigned to you",
      body: title,
      projectId: row.project_id,
    })
    .catch(() => undefined);
}

function notifyActionItemBlocked(
  deps: ActionItemsDeps,
  row: ActionItemRow,
  actorId: string,
): void {
  if (!deps.notifications || !row.created_by_id || row.created_by_id === actorId) return;
  void deps.notifications
    .notify(row.created_by_id, "action_item_blocked", {
      title: "An action item is blocked",
      body: row.title,
      projectId: row.project_id,
    })
    .catch(() => undefined);
}

function notifyActionItemResolved(
  deps: ActionItemsDeps,
  row: ActionItemRow,
  actorId: string,
): void {
  if (!deps.notifications || !row.created_by_id || row.created_by_id === actorId) return;
  void deps.notifications
    .notify(row.created_by_id, "action_item_resolved", {
      title: "An action item was resolved",
      body: row.title,
      projectId: row.project_id,
    })
    .catch(() => undefined);
}

export function actionItemsService(repository: ActionItemsRepository, deps: ActionItemsDeps = {}) {
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
      const recurUnit = input.recurrenceUnit ?? null;
      const recurInterval = recurUnit ? (input.recurrenceInterval ?? 1) : null;
      const recurUntil = recurUnit ? (input.recurrenceUntil ?? null) : null;

      const row = await repository.create({
        id: generateId("ai"),
        project_id: projectId,
        title: input.title,
        description: input.description ?? null,
        description_html: input.descriptionHtml ?? null,
        status,
        priority: input.priority ?? "Medium",
        assignee_id: input.assigneeId ?? null,
        due_date: input.dueDate ?? null,
        created_by_id: userId,
        recur_unit: recurUnit,
        recur_interval: recurInterval,
        recur_until: recurUntil,
        recur_parent_id: null,
      });

      if (status === "Resolved") {
        const updated = await repository.update(row.id, { resolved_at: new Date().toISOString() });
        return toItem(updated ?? row, 0);
      }

      notifyAssignee(deps, row, userId, input.title);
      return toItem(row, 0);
    },

    async update(
      projectId: string,
      itemId: string,
      input: UpdateActionItemInput,
      userId: string,
    ): Promise<ActionItem> {
      const existing = await repository.findById(itemId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Action item");

      const patch: ActionItemUpdatePatch = { updated_at: new Date().toISOString() };
      if (input.title !== undefined) patch.title = input.title;
      if (input.description !== undefined) patch.description = input.description;
      if (input.descriptionHtml !== undefined) patch.description_html = input.descriptionHtml;
      if (input.priority !== undefined) patch.priority = input.priority;
      if (input.assigneeId !== undefined) patch.assignee_id = input.assigneeId;
      if (input.dueDate !== undefined) {
        patch.due_date = input.dueDate;
        if (input.dueDate !== existing.due_date) patch.reminded_at = null;
      }
      if (input.recurrenceUnit !== undefined) {
        patch.recur_unit = input.recurrenceUnit;
        if (input.recurrenceUnit === null) {
          patch.recur_interval = null;
          patch.recur_until = null;
        } else {
          patch.recur_interval = input.recurrenceInterval ?? existing.recur_interval ?? 1;
        }
      } else if (input.recurrenceInterval !== undefined) {
        patch.recur_interval = input.recurrenceInterval;
      }
      if (input.recurrenceUntil !== undefined) patch.recur_until = input.recurrenceUntil;

      let spawn = false;
      if (input.status !== undefined) {
        patch.status = input.status;
        if (input.status === "Resolved" && existing.status !== "Resolved") {
          patch.resolved_at = new Date().toISOString();
          spawn = Boolean(existing.recur_unit);
          notifyActionItemResolved(deps, existing, userId);
        } else if (input.status === "Blocked" && existing.status !== "Blocked") {
          notifyActionItemBlocked(deps, existing, userId);
        } else if (input.status !== "Resolved" && existing.status === "Resolved") {
          patch.resolved_at = null;
        }
      }

      const updated = await repository.update(itemId, patch);
      if (!updated) throw new NotFoundError("Action item");
      if (spawn) await spawnNextOccurrence(repository, existing);

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
