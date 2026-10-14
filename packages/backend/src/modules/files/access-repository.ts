import type { Knex } from "knex";

/** Resolve the records which actually disclose a file; project membership is insufficient. */
export function fileAccessRepository(db: Knex) {
  return {
    async projectReferences(fileId: string) {
      const select = (query: Knex.QueryBuilder, resource: string, action = "view") =>
        query.select("p.project_id", db.raw("? as resource", [resource]), db.raw("? as action", [action]));
      const urlPattern = `%/files/${fileId.replace(/[\\%_]/g, "\\$&")}/%`;
      const results = await Promise.all([
        select(db("project_documents as p").where("p.file_id", fileId), "documents"),
        select(db("document_versions as v").join("project_documents as p", "p.id", "v.document_id").where("v.file_id", fileId), "documents"),
        select(db("drawing_markup_comments as c").join("drawing_markups as p", "p.id", "c.markup_id").where("c.file_id", fileId), "documents"),
        select(db("project_transactions as p").where("p.receipt_file_id", fileId), "finances", "viewCosts"),
        select(db("project_invoices as p").where("p.source_file_id", fileId).where("p.direction", "payable"), "finances", "viewCosts"),
        select(db("project_invoices as p").where("p.source_file_id", fileId).where("p.direction", "receivable"), "finances"),
        select(db("update_media as m").join("project_updates as p", "p.id", "m.update_id").whereLike("m.url", urlPattern), "updates"),
        select(db("material_ledger_entry_files as f").join("material_ledger_entries as p", "p.id", "f.entry_id").where("f.file_id", fileId), "materials"),
        select(db("daily_log_entries as p").whereLike("p.body_html", urlPattern), "dailyLog"),
        select(db("rfis as p").whereLike("p.question_html", urlPattern), "rfis").select("p.visibility"),
        select(db("rfi_comments as c").join("rfis as p", "p.id", "c.rfi_id")
          .where((q) => q.whereLike("c.content_html", urlPattern).orWhereRaw("c.attachments::jsonb @> ?::jsonb", [JSON.stringify([{ fileId }])])), "rfis").select("p.visibility", "c.is_proposed_response"),
        select(db("change_requests as p").whereLike("p.description", urlPattern), "change-requests"),
        select(db("change_request_comments as c").join("change_requests as p", "p.id", "c.change_request_id").whereLike("c.body", urlPattern), "change-requests"),
        select(db("takeoff_jobs as p").where("p.file_id", fileId), "takeoffs"),
      ]);
      return results.flat() as { project_id: string; resource: string; action: string; visibility?: string; is_proposed_response?: boolean }[];
    },
    async organizationReferences(fileId: string) {
      const rows = await Promise.all([
        db("proposal_plans as f").join("proposals as p", "p.id", "f.proposal_id").where("f.file_id", fileId).select<{ organizationId: string }[]>("p.org_id as organizationId"),
        db("estimates as e").join("proposals as p", "p.id", "e.proposal_id").where("e.snapshot_file_id", fileId).select<{ organizationId: string }[]>("p.org_id as organizationId"),
      ]);
      return rows.flat().map((row) => ({ ...row, resource: "proposals", action: "view" }));
    },
    async messageReferences(fileId: string, userId: string) {
      return db("messages as m").join("channels as c", "c.id", "m.channel_id")
        .leftJoin("channel_members as member", (join) => join.on("member.channel_id", "c.id").andOnVal("member.user_id", userId)).whereNull("m.deleted_at")
        .whereRaw("m.attachments::jsonb @> ?::jsonb", [JSON.stringify([{ fileId }])])
        .select<{ projectId: string | null; organizationId: string | null; memberId: string | null }[]>("c.project_id as projectId", "c.organization_id as organizationId", "member.user_id as memberId");
    },
  };
}

export type FileAccessRepository = ReturnType<typeof fileAccessRepository>;
