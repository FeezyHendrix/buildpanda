import type { Knex } from "knex";
import type { ApprovalCommentRow, ApprovalRow, ApprovalStatus } from "./types.ts";

export interface NewApprovalRecord {
  id: string;
  project_id: string;
  title: string;
  category: string | null;
  description: string | null;
  status: ApprovalStatus;
  due_date: string | null;
  submitted_by_id: string | null;
}

export interface ApprovalUpdatePatch {
  title?: string;
  category?: string | null;
  description?: string | null;
  status?: ApprovalStatus;
  response?: string | null;
  due_date?: string | null;
  reviewed_by_id?: string | null;
  reviewed_at?: string | null;
  updated_at?: string;
}

const SELECT = [
  "a.id",
  "a.project_id",
  "a.title",
  "a.category",
  "a.description",
  "a.status",
  "a.response",
  "a.due_date",
  "a.submitted_by_id",
  "a.reviewed_by_id",
  "u.name as reviewed_by_name",
  "a.reviewed_at",
  "a.created_at",
  "a.updated_at",
] as const;

export function approvalsRepository(db: Knex) {
  function base() {
    return db("approvals as a").leftJoin("user as u", "u.id", "a.reviewed_by_id");
  }

  return {
    listByProject(projectId: string, status?: ApprovalStatus): Promise<ApprovalRow[]> {
      const q = base().where("a.project_id", projectId);
      if (status) q.andWhere("a.status", status);
      return q.select(...SELECT).orderBy("a.created_at", "desc");
    },

    findById(id: string): Promise<ApprovalRow | undefined> {
      return base().where("a.id", id).select(...SELECT).first();
    },

    async commentCounts(approvalIds: string[]): Promise<Map<string, number>> {
      if (approvalIds.length === 0) return new Map();
      const rows = await db("approval_comments")
        .whereIn("approval_id", approvalIds)
        .groupBy("approval_id")
        .select("approval_id")
        .count<{ approval_id: string; count: string }[]>("id as count");
      return new Map(rows.map((r) => [r.approval_id, Number(r.count)]));
    },

    async create(record: NewApprovalRecord): Promise<ApprovalRow> {
      await db("approvals").insert(record);
      const row = await this.findById(record.id);
      if (!row) throw new Error("Failed to insert approval");
      return row;
    },

    async update(id: string, patch: ApprovalUpdatePatch): Promise<ApprovalRow | undefined> {
      await db("approvals").where({ id }).update(patch);
      return this.findById(id);
    },

    async remove(id: string): Promise<void> {
      await db("approvals").where({ id }).del();
    },

    listComments(approvalId: string): Promise<ApprovalCommentRow[]> {
      return db<ApprovalCommentRow>("approval_comments")
        .where({ approval_id: approvalId })
        .orderBy("created_at", "asc");
    },

    async addComment(record: ApprovalCommentRow): Promise<ApprovalCommentRow> {
      const [row] = await db("approval_comments").insert(record).returning("*");
      if (!row) throw new Error("Failed to insert comment");
      return row as ApprovalCommentRow;
    },
  };
}

export type ApprovalsRepository = ReturnType<typeof approvalsRepository>;
