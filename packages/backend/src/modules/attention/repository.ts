import type { Knex } from "knex";
import type { AttentionKind, AttentionRow } from "./types.ts";

/**
 * One query per source table, each shaped to AttentionRow. Only rows that can
 * still need attention are fetched; the service decides the tag.
 */
export function attentionRepository(db: Knex) {
  const shape = (kind: AttentionKind, q: Knex.QueryBuilder) => q.select(db.raw("? as kind", [kind]));

  const sources: Record<AttentionKind, (projectId: string, sharedOnly: boolean) => Knex.QueryBuilder> = {
    rfi: (projectId, sharedOnly) => {
      const q = db("rfis as r")
        .leftJoin("user as u", "u.id", "r.ball_in_court_id")
        .where("r.project_id", projectId)
        .whereIn("r.status", ["Draft", "Open", "InReview"]);
      if (sharedOnly) q.andWhere("r.visibility", "shared");
      return shape("rfi", q).select(
        "r.id",
        db.raw("('RFI-' || r.number || ' ' || r.subject) as title"),
        "r.status",
        "r.due_date",
        "r.ball_in_court_id as assignee_id",
        db.raw("COALESCE(r.ball_in_court_name, u.name) as assignee_name"),
        "u.profession as assignee_profession",
      );
    },
    approval: (projectId) =>
      shape(
        "approval",
        db("approvals as a")
          .leftJoin("user as u", "u.id", "a.requested_reviewer_id")
          .where({ "a.project_id": projectId, "a.kind": "client" })
          .whereIn("a.status", ["Pending", "Resubmit"]),
      ).select("a.id", "a.title", "a.status", "a.due_date", "a.requested_reviewer_id as assignee_id", "u.name as assignee_name", "u.profession as assignee_profession"),
    change_request: (projectId) =>
      shape(
        "change_request",
        db("change_requests as c")
          .leftJoin("user as u", "u.id", "c.assignee_id")
          .where("c.project_id", projectId)
          .whereIn("c.status", ["Submitted", "Rejected"]),
      ).select("c.id", "c.title", "c.status", db.raw("NULL::date as due_date"), "c.assignee_id", "u.name as assignee_name", "u.profession as assignee_profession"),
    task: (projectId) =>
      shape(
        "task",
        db("tasks as t")
          .join("task_columns as col", "col.id", "t.column_id")
          .leftJoin("user as u", "u.id", "t.assignee_id")
          .where("t.project_id", projectId)
          .whereNot("col.status", "Done")
          .whereNotNull("t.due_date"),
      ).select("t.id", "t.title", "col.status", "t.due_date", "t.assignee_id", "u.name as assignee_name", "u.profession as assignee_profession"),
    inspection: (projectId) =>
      shape(
        "inspection",
        db("inspections as i").leftJoin("user as u", "u.id", "i.inspector_id").where({ "i.project_id": projectId, "i.status": "Action Required" }),
      ).select("i.id", "i.title", "i.status", db.raw("NULL::date as due_date"), "i.inspector_id as assignee_id", db.raw("COALESCE(i.inspector_name, u.name) as assignee_name"), db.raw("COALESCE(i.inspector_role, u.profession) as assignee_profession")),
    permit: (projectId) =>
      shape("permit", db("permits as p").where("p.project_id", projectId).whereIn("p.status", ["Applied", "Approved", "Expired"])).select(
        "p.id",
        "p.title",
        "p.status",
        "p.expiry_date as due_date",
        db.raw("NULL as assignee_id"),
        db.raw("p.authority as assignee_name"),
        db.raw("NULL as assignee_profession"),
      ),
    key_date: (projectId) =>
      shape("key_date", db("key_dates as k").where("k.project_id", projectId).whereIn("k.status", ["Upcoming", "Missed"])).select(
        "k.id",
        "k.label as title",
        "k.status",
        "k.target_date as due_date",
        db.raw("NULL as assignee_id"),
        db.raw("NULL as assignee_name"),
        db.raw("NULL as assignee_profession"),
      ),
  };

  return {
    async candidates(projectId: string, kinds: AttentionKind[], sharedOnly: boolean): Promise<AttentionRow[]> {
      const rows = await Promise.all(kinds.map((k) => sources[k](projectId, sharedOnly) as Promise<AttentionRow[]>));
      return rows.flat();
    },
  };
}

export type AttentionRepository = ReturnType<typeof attentionRepository>;
