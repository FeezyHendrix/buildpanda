import type { Knex } from "knex";
import type { QueryCommentRow, QueryRow, QueryStatus } from "./types.ts";

export interface NewQueryRecord {
  id: string;
  project_id: string;
  subject: string;
  question: string;
  status: QueryStatus;
  due_date: string | null;
  asked_by_id: string | null;
}

export interface QueryUpdatePatch {
  subject?: string;
  question?: string;
  status?: QueryStatus;
  answer?: string | null;
  due_date?: string | null;
  answered_by_id?: string | null;
  answered_at?: string | null;
  updated_at?: string;
}

const SELECT = [
  "q.id",
  "q.project_id",
  "q.subject",
  "q.question",
  "q.status",
  "q.answer",
  "q.due_date",
  "q.asked_by_id",
  "q.answered_by_id",
  "u.name as answered_by_name",
  "q.answered_at",
  "q.created_at",
  "q.updated_at",
] as const;

export function queriesRepository(db: Knex) {
  function base() {
    return db("queries as q").leftJoin("user as u", "u.id", "q.answered_by_id");
  }

  return {
    listByProject(projectId: string, status?: QueryStatus): Promise<QueryRow[]> {
      const q = base().where("q.project_id", projectId);
      if (status) q.andWhere("q.status", status);
      return q.select(...SELECT).orderBy("q.created_at", "desc");
    },

    findById(id: string): Promise<QueryRow | undefined> {
      return base().where("q.id", id).select(...SELECT).first();
    },

    async commentCounts(queryIds: string[]): Promise<Map<string, number>> {
      if (queryIds.length === 0) return new Map();
      const rows = await db("query_comments")
        .whereIn("query_id", queryIds)
        .groupBy("query_id")
        .select("query_id")
        .count<{ query_id: string; count: string }[]>("id as count");
      return new Map(rows.map((r) => [r.query_id, Number(r.count)]));
    },

    async create(record: NewQueryRecord): Promise<QueryRow> {
      await db("queries").insert(record);
      const row = await this.findById(record.id);
      if (!row) throw new Error("Failed to insert query");
      return row;
    },

    async update(id: string, patch: QueryUpdatePatch): Promise<QueryRow | undefined> {
      await db("queries").where({ id }).update(patch);
      return this.findById(id);
    },

    async remove(id: string): Promise<void> {
      await db("queries").where({ id }).del();
    },

    listComments(queryId: string): Promise<QueryCommentRow[]> {
      return db<QueryCommentRow>("query_comments")
        .where({ query_id: queryId })
        .orderBy("created_at", "asc");
    },

    async addComment(record: QueryCommentRow): Promise<QueryCommentRow> {
      const [row] = await db("query_comments").insert(record).returning("*");
      if (!row) throw new Error("Failed to insert comment");
      return row as QueryCommentRow;
    },
  };
}

export type QueriesRepository = ReturnType<typeof queriesRepository>;
