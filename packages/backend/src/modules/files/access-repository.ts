import type { Knex } from "knex";
import { narrativeOrganizationReferences, narrativeProjectReferences } from "./narrative-repository.ts";
import type { NarrativeReference } from "./narrative-types.ts";

/** Resolve the records which actually disclose a file; project membership is insufficient. */
export function fileAccessRepository(db: Knex) {
  return {
    async projectReferences(fileId: string, userId = "", projectId?: string) {
      const select = (query: Knex.QueryBuilder, resource: string, action = "view") => {
        if (projectId) query.where("p.project_id", projectId);
        return query.select("p.project_id", db.raw("? as resource", [resource]), db.raw("? as action", [action]));
      };
      const urlPattern = `%/files/${fileId.replace(/[\\%_]/g, "\\$&")}/%`;
      const results = await Promise.all([
        narrativeProjectReferences(db, fileId, userId, projectId),
        select(db("project_documents as p").where("p.file_id", fileId), "documents"),
        select(db("document_versions as v").join("project_documents as p", "p.id", "v.document_id").where("v.file_id", fileId), "documents"),
        select(db("drawing_markup_comments as c").join("drawing_markups as p", "p.id", "c.markup_id").where("c.file_id", fileId), "documents"),
        select(db("project_transactions as p").where("p.receipt_file_id", fileId), "finances", "viewCosts")
          .select("p.id as expense_id", "p.created_by_id as expense_created_by_id"),
        select(db("project_invoices as p").where("p.source_file_id", fileId).where("p.direction", "payable"), "finances", "viewCosts"),
        select(db("project_invoices as p").where("p.source_file_id", fileId).where("p.direction", "receivable"), "finances"),
        select(db("update_media as m").join("project_updates as p", "p.id", "m.update_id").whereLike("m.url", urlPattern), "updates").select("p.is_draft as update_is_draft"),
        select(db("update_comments as c").join("project_updates as p", "p.id", "c.update_id").where("c.audio_file_id", fileId), "updates")
          .select("p.is_draft as update_is_draft"),
        select(db("material_ledger_entry_files as f").join("material_ledger_entries as p", "p.id", "f.entry_id").where("f.file_id", fileId), "materials"),
        select(db("rfi_comments as c").join("rfis as p", "p.id", "c.rfi_id")
          .whereRaw("c.attachments::jsonb @> ?::jsonb", [JSON.stringify([{ fileId }])]), "rfis").select("p.visibility", "c.is_proposed_response"),
        select(db("takeoff_jobs as p").where("p.file_id", fileId), "takeoffs"),
      ]);
      return results.flat() as NarrativeReference[];
    },
    async organizationReferences(fileId: string) {
      const [narratives, ...rows] = await Promise.all([
        narrativeOrganizationReferences(db, fileId),
        db("proposal_plans as f").join("proposals as p", "p.id", "f.proposal_id").where("f.file_id", fileId).select<{ organizationId: string }[]>("p.org_id as organizationId"),
        db("estimates as e").join("proposals as p", "p.id", "e.proposal_id").where("e.snapshot_file_id", fileId).select<{ organizationId: string }[]>("p.org_id as organizationId"),
      ]);
      return [...narratives, ...rows.flat().map((row) => ({ ...row, resource: "proposals", action: "view" }))];
    },
    async messageReferences(fileId: string, userId: string) {
      return db("messages as m").join("channels as c", "c.id", "m.channel_id")
        .leftJoin("channel_members as member", (join) => join.on("member.channel_id", "c.id").andOnVal("member.user_id", userId)).whereNull("m.deleted_at")
        .where((query) => query.whereRaw("m.attachments::jsonb @> ?::jsonb", [JSON.stringify([{ fileId }])])
          .orWhereLike("m.body", `%/files/${fileId.replace(/[\\%_]/g, "\\$&")}/download%`))
        .select<{ projectId: string | null; organizationId: string | null; memberId: string | null }[]>("c.project_id as projectId", "c.organization_id as organizationId", "member.user_id as memberId");
    },
  };
}

export type FileAccessRepository = ReturnType<typeof fileAccessRepository>;
