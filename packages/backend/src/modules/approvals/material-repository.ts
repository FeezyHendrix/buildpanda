import type { Knex } from "knex";
import type { ApprovalUpdatePatch } from "./repository.ts";
import type { MaterialApprovalJoinedRow } from "./material-types.ts";
import type { ApprovalCommentRow, ApprovalRow, ApprovalStatus } from "./types.ts";

export interface NewMaterialApprovalRecord {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  description_html: string | null;
  status: ApprovalStatus;
  due_date: string | null;
  submitted_by_id: string | null;
  requested_reviewer_id: string | null;
  document_id: string | null;
  document_version_id: string | null;
}

export interface NewMaterialApprovalDetailRecord {
  approval_id: string;
  material_name: string;
  specification: string | null;
  quantity: number;
  unit: string;
  supplier: string | null;
  needed_by: string | null;
  phase_id: string | null;
  activity_id: string | null;
}

export type MaterialApprovalDetailPatch = Partial<
  Omit<NewMaterialApprovalDetailRecord, "approval_id">
>;

const APPROVAL_SELECT = [
  "a.id",
  "a.project_id",
  "a.kind",
  "a.title",
  "a.category",
  "a.description",
  "a.description_html",
  "a.status",
  "a.response",
  "a.response_html",
  "a.due_date",
  "a.submitted_by_id",
  "a.requested_reviewer_id",
  "rr.name as requested_reviewer_name",
  "a.reviewed_by_id",
  "u.name as reviewed_by_name",
  "a.reviewed_at",
  "a.created_at",
  "a.updated_at",
] as const;

const DETAIL_SELECT = [
  "d.approval_id",
  "d.material_name",
  "d.specification",
  "d.quantity",
  "d.unit",
  "d.supplier",
  "d.needed_by",
  "d.phase_id",
  "p.name as phase_name",
  "d.activity_id",
  "act.name as activity_name",
] as const;

export function materialApprovalsRepository(db: Knex) {
  // Mirror image of approvalsRepository's client scope: every read and write
  // here is pinned to kind = 'material' so the two workflows stay isolated
  // even though they share the `approvals` table.
  function base() {
    return db("approvals as a")
      .where("a.kind", "material")
      .leftJoin("user as u", "u.id", "a.reviewed_by_id")
      .leftJoin("user as rr", "rr.id", "a.requested_reviewer_id");
  }

  function detailsBase() {
    return db("material_approval_details as d")
      .leftJoin("project_phases as p", "p.id", "d.phase_id")
      .leftJoin("activities as act", "act.id", "d.activity_id");
  }

  return {
    listByProject(projectId: string, status?: ApprovalStatus): Promise<ApprovalRow[]> {
      const q = base().where("a.project_id", projectId);
      if (status) q.andWhere("a.status", status);
      return q.select(...APPROVAL_SELECT).orderBy("a.created_at", "desc");
    },

    findById(id: string): Promise<ApprovalRow | undefined> {
      return base().where("a.id", id).select(...APPROVAL_SELECT).first();
    },

    async detailsFor(approvalIds: string[]): Promise<Map<string, MaterialApprovalJoinedRow>> {
      if (approvalIds.length === 0) return new Map();
      const rows: MaterialApprovalJoinedRow[] = await detailsBase()
        .whereIn("d.approval_id", approvalIds)
        .select(...DETAIL_SELECT);
      return new Map(rows.map((r) => [r.approval_id, r]));
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

    // The approval and its details are one contractual record, so they are
    // written in one transaction — a material approval with no material on it
    // is not a request anybody can act on.
    async create(
      approval: NewMaterialApprovalRecord,
      details: NewMaterialApprovalDetailRecord,
    ): Promise<ApprovalRow> {
      await db.transaction(async (trx) => {
        await trx("approvals").insert({ ...approval, kind: "material" });
        await trx("material_approval_details").insert(details);
      });
      const row = await this.findById(approval.id);
      if (!row) throw new Error("Failed to insert material approval");
      return row;
    },

    async update(
      id: string,
      patch: ApprovalUpdatePatch,
      detailPatch: MaterialApprovalDetailPatch,
    ): Promise<ApprovalRow | undefined> {
      await db.transaction(async (trx) => {
        await trx("approvals").where({ id, kind: "material" }).update(patch);
        if (Object.keys(detailPatch).length > 0) {
          await trx("material_approval_details")
            .where({ approval_id: id })
            .update({ ...detailPatch, updated_at: new Date().toISOString() });
        }
      });
      return this.findById(id);
    },

    async remove(id: string): Promise<void> {
      await db("approvals").where({ id, kind: "material" }).del();
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

export type MaterialApprovalsRepository = ReturnType<typeof materialApprovalsRepository>;
