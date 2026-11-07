import type { Knex } from "knex";
import type { RfisRepository } from "./repository.ts";
import type { RfiCounts, RfiListQuery, RfiRow } from "./types.ts";

// Still waiting on an answer: the only statuses that can be overdue.
const AWAITING = ["Draft", "Open", "InReview"] as const;

/** `?q=3`, `rfi 3`, `RFI-3` all mean number 3. */
function numberIn(q: string): number | null {
  const m = /^\s*(?:rfi\s*-?\s*)?(\d+)\s*$/i.exec(q);
  return m ? Number(m[1]) : null;
}

export function rfiListRepository(db: Knex, rfis: RfisRepository) {
  function overdueClause(q: Knex.QueryBuilder, today: string) {
    return q.whereIn("r.status", AWAITING).whereNotNull("r.due_date").andWhere("r.due_date", "<", today);
  }

  function filtered(projectId: string, query: RfiListQuery, sharedOnly: boolean, today: string) {
    const q = rfis.query().where("r.project_id", projectId);
    if (sharedOnly) q.andWhere("r.visibility", "shared");
    if (query.status?.length) q.whereIn("r.status", query.status);
    if (query.priority?.length) q.whereIn("r.priority", query.priority);
    if (query.ballInCourtId) q.andWhere("r.ball_in_court_id", query.ballInCourtId);
    if (query.overdue) overdueClause(q, today);
    // A range is on the due date, so an RFI without one is outside every range.
    if (query.dueFrom) q.andWhere("r.due_date", ">=", query.dueFrom);
    if (query.dueTo) q.andWhere("r.due_date", "<=", query.dueTo);
    if (query.q) {
      const n = numberIn(query.q);
      const like = `%${query.q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
      q.andWhere((b) => {
        b.whereILike("r.subject", like)
          .orWhereILike("r.question", like)
          .orWhereILike("r.official_response", like)
          .orWhereRaw("COALESCE(r.ball_in_court_name, bic.name) ILIKE ?", [like]);
        if (n !== null) b.orWhere("r.number", n);
      });
    }
    return q;
  }

  return {
    async search(
      projectId: string,
      query: RfiListQuery,
      sharedOnly: boolean,
      today: string,
      page: number,
      pageSize: number,
    ): Promise<{ rows: RfiRow[]; total: number }> {
      const counted = (await filtered(projectId, query, sharedOnly, today).clearSelect().count("r.id as count")) as { count: string }[];
      const q = filtered(projectId, query, sharedOnly, today);
      if (query.sort === "dueDate") q.orderByRaw("r.due_date ASC NULLS LAST, r.number DESC");
      else q.orderBy("r.number", "desc");
      const rows = await q.limit(pageSize).offset((page - 1) * pageSize);
      return { rows, total: Number(counted[0]?.count ?? 0) };
    },

    // The pills' badges, under the same visibility rule as the rows.
    async counts(projectId: string, sharedOnly: boolean, today: string): Promise<RfiCounts> {
      const scoped = () => {
        const q = db("rfis as r").where("r.project_id", projectId);
        if (sharedOnly) q.andWhere("r.visibility", "shared");
        return q;
      };
      const [byStatus, overdue] = await Promise.all([
        scoped().groupBy("r.status").select("r.status").count<{ status: string; count: string }[]>("r.id as count"),
        overdueClause(scoped(), today).count("r.id as count").first(),
      ]);
      const of = (...statuses: string[]) => byStatus.filter((r) => statuses.includes(r.status)).reduce((n, r) => n + Number(r.count), 0);
      return {
        all: of("Draft", "Open", "InReview", "Answered", "Closed"),
        open: of("Draft", "Open", "InReview"),
        answered: of("Answered"),
        closed: of("Closed"),
        overdue: Number((overdue as { count?: string } | undefined)?.count ?? 0),
      };
    },
  };
}

export type RfiListRepository = ReturnType<typeof rfiListRepository>;
