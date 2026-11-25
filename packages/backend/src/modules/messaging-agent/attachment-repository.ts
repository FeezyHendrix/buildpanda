import type { Knex } from "knex";
import type { DocumentInspection } from "./document-analysis.ts";
import type { MessagingSourceFile } from "./attachment-types.ts";

export function messagingAttachmentRepository(db: Knex) {
  return {
    async inspection(conversationId: string, fileId: string): Promise<DocumentInspection | null> {
      const row = await db("messaging_agent_inbox").where({ conversation_id: conversationId, source_file_id: fileId })
        .whereNotNull("attachment_analysis").select("attachment_analysis").first();
      return row?.attachment_analysis ?? null;
    },
    async saveInspection(conversationId: string, fileId: string, inspection: DocumentInspection) {
      await db("messaging_agent_inbox").where({ conversation_id: conversationId, source_file_id: fileId }).update({ attachment_analysis: JSON.stringify(inspection) });
    },
    sourceFiles(conversationId: string, scopeVersion: number, currentInboxId: string): Promise<(MessagingSourceFile & { projectId: string; organizationId: string | null; buildingId: string | null; userId: string })[]> {
      return db("messaging_agent_inbox as m")
        .join("messaging_agent_conversations as c", "c.id", "m.conversation_id")
        .join("messaging_agent_identity_links as i", "i.id", "c.identity_id")
        .join("messaging_agent_inbox as current", function () {
          this.on("current.conversation_id", "m.conversation_id").andOn("current.scope_version", "m.scope_version");
        })
        .join("uploaded_files as f", function () { this.on("f.id", "m.source_file_id").andOn("f.owner_id", "i.user_id").andOn("f.project_id", "c.project_id"); })
        .where({ "c.id": conversationId, "c.scope_version": scopeVersion, "m.scope_version": scopeVersion,
          "current.id": currentInboxId, "m.source_kind": "file_attachment", "c.paused": false })
        .whereNull("i.revoked_at").whereNull("i.opted_out_at")
        .whereRaw("m.project_id = c.project_id AND m.identity_id = i.id")
        .whereRaw("m.organization_id IS NOT DISTINCT FROM c.organization_id AND m.building_id IS NOT DISTINCT FROM c.building_id")
        .whereRaw("m.created_at <= current.created_at")
        .whereRaw("m.created_at > coalesce(c.context_reset_at, to_timestamp(0))")
        .select("f.id", "f.file_name as fileName", "f.mime_type as mimeType", "f.size_bytes as sizeBytes",
          "c.project_id as projectId", "c.organization_id as organizationId", "c.building_id as buildingId", "i.user_id as userId")
        .distinct().orderBy("f.id").limit(101);
    },
  };
}
