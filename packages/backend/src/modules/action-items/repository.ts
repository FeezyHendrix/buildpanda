import type { Knex } from "knex";
import type {
  ActionCommentRow,
  ActionItemRow,
  ActionPriority,
  ActionStatus,
  RecurrenceUnit,
} from "./types.ts";

export interface NewActionItemRecord {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  description_html: string | null;
  status: ActionStatus;
  priority: ActionPriority;
  assignee_id: string | null;
  due_date: string | null;
  created_by_id: string | null;
  recur_unit: RecurrenceUnit | null;
  recur_interval: number | null;
  recur_until: string | null;
  recur_parent_id: string | null;
}

export interface ActionItemUpdatePatch {
  title?: string;
  description?: string | null;
  description_html?: string | null;
  status?: ActionStatus;
  priority?: ActionPriority;
  assignee_id?: string | null;
  due_date?: string | null;
  resolved_at?: string | null;
  recur_unit?: RecurrenceUnit | null;
  recur_interval?: number | null;
  recur_until?: string | null;
  recur_parent_id?: string | null;
  reminded_at?: string | null;
  updated_at?: string;
}

const SELECT = [
  "ai.id",
  "ai.project_id",
  "ai.title",
  "ai.description",
  "ai.description_html",
  "ai.status",
  "ai.priority",
  "ai.assignee_id",
  "u.name as assignee_name",
  "ai.due_date",
  "ai.resolved_at",
  "ai.recur_unit",
  "ai.recur_interval",
  "ai.recur_until",
  "ai.recur_parent_id",
  "ai.reminded_at",
  "ai.created_by_id",
  "ai.created_at",
  "ai.updated_at",
] as const;

export function actionItemsRepository(db: Knex) {
  function base() {
    return db("action_items as ai").leftJoin("user as u", "u.id", "ai.assignee_id");
  }

  return {
    listByProject(projectId: string, status?: ActionStatus): Promise<ActionItemRow[]> {
      const q = base().where("ai.project_id", projectId);
      if (status) q.andWhere("ai.status", status);
      return q.select(...SELECT).orderBy("ai.created_at", "desc");
    },

    findById(id: string): Promise<ActionItemRow | undefined> {
      return base().where("ai.id", id).select(...SELECT).first();
    },

    listDueForReminder(asOf: string): Promise<ActionItemRow[]> {
      return base()
        .whereNotNull("ai.assignee_id")
        .whereNotNull("ai.due_date")
        .where("ai.due_date", "<=", asOf)
        .whereNull("ai.reminded_at")
        .whereNot("ai.status", "Resolved")
        .select(...SELECT)
        .orderBy("ai.due_date", "asc");
    },

    markReminded(id: string): Promise<number> {
      return db("action_items").where({ id }).update({ reminded_at: new Date() });
    },

    async commentCounts(actionItemIds: string[]): Promise<Map<string, number>> {
      if (actionItemIds.length === 0) return new Map();
      const rows = await db("action_item_comments")
        .whereIn("action_item_id", actionItemIds)
        .groupBy("action_item_id")
        .select("action_item_id")
        .count<{ action_item_id: string; count: string }[]>("id as count");
      return new Map(rows.map((r) => [r.action_item_id, Number(r.count)]));
    },

    async create(record: NewActionItemRecord): Promise<ActionItemRow> {
      await db("action_items").insert(record);
      const row = await this.findById(record.id);
      if (!row) throw new Error("Failed to insert action item");
      return row;
    },

    async update(id: string, patch: ActionItemUpdatePatch): Promise<ActionItemRow | undefined> {
      await db("action_items").where({ id }).update(patch);
      return this.findById(id);
    },

    async remove(id: string): Promise<void> {
      await db("action_items").where({ id }).del();
    },

    listComments(actionItemId: string): Promise<ActionCommentRow[]> {
      return db<ActionCommentRow>("action_item_comments")
        .where({ action_item_id: actionItemId })
        .orderBy("created_at", "asc");
    },

    async addComment(record: ActionCommentRow): Promise<ActionCommentRow> {
      const [row] = await db("action_item_comments").insert(record).returning("*");
      if (!row) throw new Error("Failed to insert comment");
      return row as ActionCommentRow;
    },
  };
}

export type ActionItemsRepository = ReturnType<typeof actionItemsRepository>;
