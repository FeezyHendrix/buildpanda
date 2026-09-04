import type { Knex } from "knex";
import type {
  ChangeCommentRow,
  ChangeRequestRow,
  ChangeStatus,
  Currency,
} from "./types.ts";

export interface NewChangeRequestRecord {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  description_html: string | null;
  reason: string | null;
  reason_html: string | null;
  status: ChangeStatus;
  cost_impact: string;
  time_impact_days: number;
  currency: Currency;
  submitted_by_id: string | null;
  assignee_id?: string | null;
}

export interface ChangeRequestUpdatePatch {
  title?: string;
  description?: string | null;
  description_html?: string | null;
  reason?: string | null;
  reason_html?: string | null;
  status?: ChangeStatus;
  cost_impact?: string;
  time_impact_days?: number;
  currency?: Currency;
  decided_by_id?: string | null;
  decided_at?: string | null;
  assignee_id?: string | null;
  updated_at?: string;
}

const SELECT = [
  "c.id",
  "c.project_id",
  "c.title",
  "c.description",
  "c.description_html",
  "c.reason",
  "c.reason_html",
  "c.status",
  "c.cost_impact",
  "c.time_impact_days",
  "c.currency",
  "c.submitted_by_id",
  "c.decided_by_id",
  "u.name as decided_by_name",
  "c.decided_at",
  "c.assignee_id",
  "asg.name as assignee_name",
  "c.created_at",
  "c.updated_at",
] as const;

export function changeRequestsRepository(db: Knex) {
  function base() {
    return db("change_requests as c")
      .leftJoin("user as u", "u.id", "c.decided_by_id")
      .leftJoin("user as asg", "asg.id", "c.assignee_id");
  }

  return {
    listByProject(projectId: string, status?: ChangeStatus): Promise<ChangeRequestRow[]> {
      const q = base().where("c.project_id", projectId);
      if (status) q.andWhere("c.status", status);
      return q.select(...SELECT).orderBy("c.created_at", "desc");
    },

    findById(id: string): Promise<ChangeRequestRow | undefined> {
      return base().where("c.id", id).select(...SELECT).first();
    },

    async commentCounts(ids: string[]): Promise<Map<string, number>> {
      if (ids.length === 0) return new Map();
      const rows = await db("change_request_comments")
        .whereIn("change_request_id", ids)
        .groupBy("change_request_id")
        .select("change_request_id")
        .count<{ change_request_id: string; count: string }[]>("id as count");
      return new Map(rows.map((r) => [r.change_request_id, Number(r.count)]));
    },

    async create(record: NewChangeRequestRecord): Promise<ChangeRequestRow> {
      await db("change_requests").insert(record);
      const row = await this.findById(record.id);
      if (!row) throw new Error("Failed to insert change request");
      return row;
    },

    async update(id: string, patch: ChangeRequestUpdatePatch): Promise<ChangeRequestRow | undefined> {
      await db("change_requests").where({ id }).update(patch);
      return this.findById(id);
    },

    async remove(id: string): Promise<void> {
      await db("change_requests").where({ id }).del();
    },

    listComments(changeRequestId: string): Promise<ChangeCommentRow[]> {
      return db<ChangeCommentRow>("change_request_comments")
        .where({ change_request_id: changeRequestId })
        .orderBy("created_at", "asc");
    },

    async addComment(record: ChangeCommentRow): Promise<ChangeCommentRow> {
      const [row] = await db("change_request_comments").insert(record).returning("*");
      if (!row) throw new Error("Failed to insert comment");
      return row as ChangeCommentRow;
    },

    listBudgetLinks(changeRequestId: string): Promise<BudgetLinkRow[]> {
      return db<BudgetLinkRow>("change_request_budget_links")
        .where({ change_request_id: changeRequestId })
        .select("id", "change_request_id", "budget_category_id", "amount", "committed");
    },

    async replaceBudgetLinks(
      changeRequestId: string,
      links: NewBudgetLinkRecord[],
    ): Promise<void> {
      await db.transaction(async (trx) => {
        await trx("change_request_budget_links")
          .where({ change_request_id: changeRequestId })
          .delete();
        if (links.length > 0) {
          await trx("change_request_budget_links").insert(links);
        }
      });
    },
  };
}

export interface BudgetLinkRow {
  id: string;
  change_request_id: string;
  budget_category_id: string;
  amount: string;
  committed: boolean;
}

export interface NewBudgetLinkRecord {
  id: string;
  change_request_id: string;
  budget_category_id: string;
  amount: string;
  committed: boolean;
}

export type ChangeRequestsRepository = ReturnType<typeof changeRequestsRepository>;
