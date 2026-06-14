import type { Knex } from "knex";
import type {
  RfiCommentRow,
  RfiDistributionRole,
  RfiDistributionRow,
  RfiEventRow,
  RfiPriority,
  RfiRow,
  RfiStatus,
  RfiVisibility,
} from "./types.ts";

export interface NewRfiDistributionRecord {
  id: string;
  rfi_id: string;
  user_id: string | null;
  email: string | null;
  name: string | null;
  role: RfiDistributionRole;
  reply_token_hash: string | null;
  token_expires_at: string | null;
}

export interface NewRfiRecord {
  id: string;
  project_id: string;
  subject: string;
  question: string;
  status: RfiStatus;
  priority: RfiPriority;
  visibility: RfiVisibility;
  ball_in_court_id: string | null;
  assignee_role: string | null;
  due_date: string | null;
  cost_impact: boolean;
  schedule_impact: boolean;
  created_by_id: string | null;
}

export interface RfiUpdatePatch {
  subject?: string;
  question?: string;
  status?: RfiStatus;
  priority?: RfiPriority;
  visibility?: RfiVisibility;
  ball_in_court_id?: string | null;
  assignee_role?: string | null;
  due_date?: string | null;
  official_response?: string | null;
  official_responded_by_id?: string | null;
  official_responded_at?: string | null;
  cost_impact?: boolean;
  schedule_impact?: boolean;
  change_request_id?: string | null;
  reopened_count?: number;
  updated_at?: string;
}

const SELECT = [
  "r.id",
  "r.project_id",
  "r.number",
  "r.subject",
  "r.question",
  "r.status",
  "r.priority",
  "r.visibility",
  "r.ball_in_court_id",
  "bic.name as ball_in_court_name",
  "r.assignee_role",
  "r.due_date",
  "r.official_response",
  "r.official_responded_by_id",
  "resp.name as official_responded_by_name",
  "r.official_responded_at",
  "r.cost_impact",
  "r.schedule_impact",
  "r.change_request_id",
  "r.reopened_count",
  "r.created_by_id",
  "r.created_at",
  "r.updated_at",
] as const;

export function rfisRepository(db: Knex) {
  function base() {
    return db("rfis as r")
      .leftJoin("user as bic", "bic.id", "r.ball_in_court_id")
      .leftJoin("user as resp", "resp.id", "r.official_responded_by_id");
  }

  return {
    listByProject(
      projectId: string,
      filter: { status?: RfiStatus; ballInCourtId?: string; sharedOnly?: boolean },
    ): Promise<RfiRow[]> {
      const q = base().where("r.project_id", projectId);
      if (filter.status) q.andWhere("r.status", filter.status);
      if (filter.ballInCourtId) q.andWhere("r.ball_in_court_id", filter.ballInCourtId);
      if (filter.sharedOnly) q.andWhere("r.visibility", "shared");
      return q.select(...SELECT).orderBy("r.number", "desc");
    },

    findById(id: string): Promise<RfiRow | undefined> {
      return base().where("r.id", id).select(...SELECT).first();
    },

    async commentCounts(rfiIds: string[]): Promise<Map<string, number>> {
      if (rfiIds.length === 0) return new Map();
      const rows = await db("rfi_comments")
        .whereIn("rfi_id", rfiIds)
        .groupBy("rfi_id")
        .select("rfi_id")
        .count<{ rfi_id: string; count: string }[]>("id as count");
      return new Map(rows.map((r) => [r.rfi_id, Number(r.count)]));
    },

    async create(record: NewRfiRecord): Promise<RfiRow> {
      const id = await db.transaction(async (trx) => {
        const existing = await trx("rfi_counters")
          .where({ project_id: record.project_id })
          .forUpdate()
          .first<{ next_number: number }>();

        let number: number;
        if (existing) {
          number = existing.next_number;
          await trx("rfi_counters")
            .where({ project_id: record.project_id })
            .update({ next_number: number + 1 });
        } else {
          number = 1;
          await trx("rfi_counters").insert({
            project_id: record.project_id,
            next_number: 2,
          });
        }

        await trx("rfis").insert({ ...record, number });
        return record.id;
      });

      const row = await this.findById(id);
      if (!row) throw new Error("Failed to insert RFI");
      return row;
    },

    async update(id: string, patch: RfiUpdatePatch): Promise<RfiRow | undefined> {
      await db("rfis").where({ id }).update(patch);
      return this.findById(id);
    },

    listComments(rfiId: string): Promise<RfiCommentRow[]> {
      return db<RfiCommentRow>("rfi_comments")
        .where({ rfi_id: rfiId })
        .orderBy("created_at", "asc");
    },

    async addComment(record: {
      id: string;
      rfi_id: string;
      author_id: string;
      author_name: string;
      body: string;
      is_proposed_response: boolean;
      created_at: string;
      content_html?: string | null;
      attachments?: unknown;
      references?: unknown;
    }): Promise<RfiCommentRow> {
      const insertRecord = {
        id: record.id,
        rfi_id: record.rfi_id,
        author_id: record.author_id,
        author_name: record.author_name,
        body: record.body,
        is_proposed_response: record.is_proposed_response,
        created_at: record.created_at,
        content_html: record.content_html ?? null,
        attachments: record.attachments ? JSON.stringify(record.attachments) : null,
        references: record.references ? JSON.stringify(record.references) : null,
      };
      const [row] = await db("rfi_comments").insert(insertRecord).returning("*");
      if (!row) throw new Error("Failed to insert RFI comment");
      return row as RfiCommentRow;
    },

    listEvents(rfiId: string): Promise<RfiEventRow[]> {
      return db<RfiEventRow>("rfi_events")
        .where({ rfi_id: rfiId })
        .orderBy("created_at", "asc");
    },

    async addEvent(record: Omit<RfiEventRow, "created_at">): Promise<void> {
      await db("rfi_events").insert(record);
    },

    listDistribution(rfiId: string): Promise<RfiDistributionRow[]> {
      return db<RfiDistributionRow>("rfi_distribution")
        .where({ rfi_id: rfiId })
        .orderBy("created_at", "asc");
    },

    async addDistribution(record: NewRfiDistributionRecord): Promise<RfiDistributionRow> {
      const [row] = await db("rfi_distribution").insert(record).returning("*");
      if (!row) throw new Error("Failed to insert RFI distribution");
      return row as RfiDistributionRow;
    },

    distributionByTokenHash(hash: string): Promise<RfiDistributionRow | undefined> {
      return db<RfiDistributionRow>("rfi_distribution")
        .where({ reply_token_hash: hash })
        .first();
    },

    async consumeDistributionToken(id: string): Promise<void> {
      await db("rfi_distribution")
        .where({ id })
        .update({ token_consumed_at: new Date().toISOString() });
    },

    listDueForReminder(today: string): Promise<RfiRow[]> {
      return base()
        .whereIn("r.status", ["Open", "InReview"])
        .whereNotNull("r.due_date")
        .andWhere("r.due_date", "<=", today)
        .andWhere((b) => b.whereNull("r.last_reminded_on").orWhere("r.last_reminded_on", "<", today))
        .select(...SELECT);
    },

    async markReminded(id: string, today: string): Promise<void> {
      await db("rfis").where({ id }).update({ last_reminded_on: today });
    },
  };
}

export type RfisRepository = ReturnType<typeof rfisRepository>;
