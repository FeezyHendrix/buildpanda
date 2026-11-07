import type { Knex } from "knex";
import type { UploadedFileRow } from "../files/types.ts";
import type {
  ApprovalAttachmentRow,
  ApprovalCategoryRow,
  ApprovalCommentRow,
  ApprovalDecisionRow,
  ApprovalListQuery,
  ApprovalRow,
  ApprovalStatus,
  ApprovalViewer,
} from "./types.ts";

export interface NewApprovalRecord {
  id: string;
  project_id: string;
  title: string;
  category: string | null;
  description: string | null;
  description_html: string | null;
  status: ApprovalStatus;
  due_date: string | null;
  submitted_by_id: string | null;
  requested_reviewer_id: string | null;
  document_id: string | null;
  document_version_id: string | null;
  source_markup_id: string | null;
}

export interface ApprovalUpdatePatch {
  title?: string;
  category?: string | null;
  description?: string | null;
  description_html?: string | null;
  status?: ApprovalStatus;
  response?: string | null;
  response_html?: string | null;
  due_date?: string | null;
  requested_reviewer_id?: string | null;
  reviewed_by_id?: string | null;
  reviewed_at?: string | null;
  revision?: number;
  // Decision-chasing reminder state (see lifecycle/decision-chasing-job.ts).
  reminder_level?: number | null;
  last_reminded_at?: string | null;
  updated_at?: string;
}

/** An attachment row joined to the uploaded file behind it. */
export type AttachmentWithFile = ApprovalAttachmentRow & {
  file: UploadedFileRow;
  current_version_id: string | null;
};

/** Someone who might be allowed to decide; the service applies the rule. */
export interface ApproverCandidate {
  id: string;
  name: string;
  org_role: string | null;
  participant_role: string | null;
  permissions: Record<string, unknown> | null;
  grants: Record<string, readonly string[]> | null;
}

const SELECT = [
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
  "a.revision",
  "a.created_at",
  "a.updated_at",
] as const;

export function approvalsRepository(db: Knex) {
  // Scoped to client approvals throughout. Material approval requests share the
  // table (see 20260807_material_approvals) and are served by
  // materialApprovalsRepository — this repository must never read or write one,
  // including on findById, which guards update/delete/comment as well as reads.
  function base() {
    return db("approvals as a")
      .where("a.kind", "client")
      .leftJoin("user as u", "u.id", "a.reviewed_by_id")
      .leftJoin("user as rr", "rr.id", "a.requested_reviewer_id");
  }

  // "Pending and this caller may decide it": the PATCH guard, as SQL.
  function needsMe(q: Knex.QueryBuilder, viewer: ApprovalViewer) {
    if (!viewer.canDecide) return q.whereRaw("1 = 0");
    return q
      .where("a.status", "Pending")
      .andWhere((b) => b.whereNull("a.requested_reviewer_id").orWhere("a.requested_reviewer_id", viewer.id));
  }

  function filtered(projectId: string, query: ApprovalListQuery, viewer: ApprovalViewer, timeZone: string) {
    const q = base().where("a.project_id", projectId);
    if (query.status?.length) q.whereIn("a.status", query.status);
    if (query.needsMyDecision) needsMe(q, viewer);
    if (query.q) {
      const like = `%${query.q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
      q.andWhere((b) =>
        b.whereILike("a.title", like).orWhereILike("a.description", like).orWhereILike("a.category", like).orWhereILike("rr.name", like),
      );
    }
    if (query.submittedFrom) q.whereRaw("(a.created_at AT TIME ZONE ?)::date >= ?", [timeZone, query.submittedFrom]);
    if (query.submittedTo) q.whereRaw("(a.created_at AT TIME ZONE ?)::date <= ?", [timeZone, query.submittedTo]);
    return q;
  }

  return {
    listByProject(projectId: string, status?: ApprovalStatus): Promise<ApprovalRow[]> {
      const q = base().where("a.project_id", projectId);
      if (status) q.andWhere("a.status", status);
      return q.select(...SELECT).orderBy("a.created_at", "desc");
    },

    async search(
      projectId: string,
      query: ApprovalListQuery,
      viewer: ApprovalViewer,
      timeZone: string,
      page: number,
      pageSize: number,
    ): Promise<{ rows: ApprovalRow[]; total: number }> {
      const counted = (await filtered(projectId, query, viewer, timeZone).count("a.id as count")) as { count: string }[];
      const count = counted[0]?.count ?? 0;
      const q = filtered(projectId, query, viewer, timeZone).select(...SELECT);
      const mine = viewer.canDecide
        ? db.raw("(a.status = 'Pending' AND (a.requested_reviewer_id IS NULL OR a.requested_reviewer_id = ?))", [viewer.id])
        : db.raw("false");
      switch (query.sort ?? "attention") {
        case "newest":
          q.orderBy("a.created_at", "desc");
          break;
        case "oldest":
          q.orderBy("a.created_at", "asc");
          break;
        case "dueDate":
          q.orderByRaw("a.due_date ASC NULLS LAST, a.created_at DESC");
          break;
        default:
          q.orderByRaw(
            `CASE WHEN ${mine.toQuery()} THEN 0 WHEN a.status = 'Pending' THEN 1 WHEN a.status = 'Resubmit' THEN 2 ELSE 3 END, a.created_at DESC`,
          );
      }
      const rows = await q.limit(pageSize).offset((page - 1) * pageSize);
      return { rows, total: Number(count) };
    },

    async counts(projectId: string, viewer: ApprovalViewer) {
      const [byStatus, mine] = await Promise.all([
        db("approvals as a")
          .where({ "a.kind": "client", "a.project_id": projectId })
          .groupBy("a.status")
          .select("a.status")
          .count<{ status: ApprovalStatus; count: string }[]>("a.id as count"),
        needsMe(db("approvals as a").where({ "a.kind": "client", "a.project_id": projectId }), viewer).count("a.id as count").first(),
      ]);
      const of = (s: ApprovalStatus) => Number(byStatus.find((r) => r.status === s)?.count ?? 0);
      const needsMeCount = Number((mine as { count?: string } | undefined)?.count ?? 0);
      return {
        needsMe: needsMeCount,
        awaiting: of("Pending") - needsMeCount,
        approved: of("Approved"),
        rejected: of("Rejected"),
        changesRequested: of("Resubmit"),
      };
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

    // The approval and its attachment rows land together or not at all.
    async create(record: NewApprovalRecord, attachments: ApprovalAttachmentRow[] = []): Promise<ApprovalRow> {
      await db.transaction(async (trx) => {
        await trx("approvals").insert({ ...record, kind: "client" });
        if (attachments.length > 0) await trx("approval_attachments").insert(attachments);
      });
      const row = await this.findById(record.id);
      if (!row) throw new Error("Failed to insert approval");
      return row;
    },

    // A status change and its history row are one write.
    async update(id: string, patch: ApprovalUpdatePatch, decision?: ApprovalDecisionRow): Promise<ApprovalRow | undefined> {
      await db.transaction(async (trx) => {
        await trx("approvals").where({ id, kind: "client" }).update(patch);
        if (decision) await trx("approval_decisions").insert(decision);
      });
      return this.findById(id);
    },

    async resubmit(
      id: string,
      patch: ApprovalUpdatePatch,
      attachments: ApprovalAttachmentRow[],
      decision: ApprovalDecisionRow,
    ): Promise<ApprovalRow | undefined> {
      await db.transaction(async (trx) => {
        await trx("approvals").where({ id, kind: "client" }).update(patch);
        if (attachments.length > 0) await trx("approval_attachments").insert(attachments);
        await trx("approval_decisions").insert(decision);
      });
      return this.findById(id);
    },

    async remove(id: string): Promise<void> {
      await db("approvals").where({ id, kind: "client" }).del();
    },

    // Every revision's attachments, oldest revision first; the service picks the current ones.
    listAttachments(approvalIds: string[]): Promise<AttachmentWithFile[]> {
      if (approvalIds.length === 0) return Promise.resolve([]);
      return db("approval_attachments as aa")
        .leftJoin("document_versions as dv", "dv.id", "aa.document_version_id")
        .leftJoin("project_documents as d", "d.id", "aa.document_id")
        .join("uploaded_files as f", "f.id", db.raw("COALESCE(aa.file_id, dv.file_id)"))
        .whereIn("aa.approval_id", approvalIds)
        .orderBy([
          { column: "aa.approval_id" },
          { column: "aa.revision" },
          { column: "aa.position" },
        ])
        .select("aa.*", "d.current_version_id", db.raw("row_to_json(f.*) as file"));
    },

    async attachedFileIds(fileIds: string[], exceptApprovalId?: string): Promise<string[]> {
      if (fileIds.length === 0) return [];
      const q = db("approval_attachments").whereIn("file_id", fileIds).select("file_id");
      if (exceptApprovalId) q.whereNot("approval_id", exceptApprovalId);
      const rows = await q;
      return rows.map((r) => r.file_id as string);
    },

    async addAttachments(rows: ApprovalAttachmentRow[]): Promise<void> {
      if (rows.length > 0) await db("approval_attachments").insert(rows);
    },

    async removeAttachments(approvalId: string, ids: string[]): Promise<number> {
      if (ids.length === 0) return 0;
      return db("approval_attachments").where({ approval_id: approvalId }).whereIn("id", ids).del();
    },

    listDecisions(approvalId: string): Promise<ApprovalDecisionRow[]> {
      return db("approval_decisions as d")
        .leftJoin("user as u", "u.id", "d.actor_id")
        .where("d.approval_id", approvalId)
        .orderBy("d.decided_at", "asc")
        .select("d.*", "u.name as actor_name");
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

    // Everyone with a seat on the project: the owner, the org's members and the
    // active participants who have an account. The service decides who may decide.
    async approverCandidates(projectId: string, organizationId: string | null, ownerId: string | null): Promise<ApproverCandidate[]> {
      const members = organizationId
        ? await db("member as m")
            .join("user as u", "u.id", "m.userId")
            .where("m.organizationId", organizationId)
            .select<ApproverCandidate[]>("u.id", "u.name", "m.role as org_role")
        : [];
      const participants = await db("project_participants as p")
        .join("user as u", "u.id", "p.user_id")
        .where({ "p.project_id": projectId, "p.status": "active" })
        .select<ApproverCandidate[]>("u.id", "u.name", "p.role as participant_role", "p.permissions", "p.grants");
      const owner = ownerId ? await db("user").where("id", ownerId).select<ApproverCandidate[]>("id", "name") : [];
      return [...owner.map((o) => ({ ...o, org_role: "owner" })), ...members, ...participants];
    },

    listCategories(projectId: string): Promise<ApprovalCategoryRow[]> {
      return db<ApprovalCategoryRow>("approval_categories").where({ project_id: projectId }).orderBy("position", "asc");
    },

    async replaceCategories(rows: ApprovalCategoryRow[], projectId: string): Promise<void> {
      await db.transaction(async (trx) => {
        await trx("approval_categories").where({ project_id: projectId }).del();
        if (rows.length > 0) await trx("approval_categories").insert(rows);
      });
    },
  };
}

export type ApprovalsRepository = ReturnType<typeof approvalsRepository>;
