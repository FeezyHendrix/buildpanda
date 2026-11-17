import type { Knex } from "knex";
import type { VoiceOption } from "@buildpanda/voice-actions";
import type { MessagingDiaryTarget, MessagingLedgerTarget, MessagingRfiTarget } from "./tool-discovery-types.ts";

/** Supplemental targets retain canonical state and revision information absent from the compact voice snapshot. */
export function messagingToolDiscoveryRepository(db: Knex) {
  return {
    rfis: (projectId: string, sharedOnly: boolean) => db("rfis").where({ project_id: projectId })
      .modify((query) => { if (sharedOnly) query.where("visibility", "shared"); })
      .orderBy("number", "desc").limit(100).select<MessagingRfiTarget[]>("id", "number", "subject", "status"),
    ledgerEntries: (projectId: string) => db("material_ledger_entries").where({ project_id: projectId, status: "Posted" })
      .whereIn("entry_type", ["IN", "USED"]).orderBy("created_at", "desc").limit(100)
      .select<MessagingLedgerTarget[]>("id", "entry_type as entryType", "material_name_snapshot as materialName", "quantity", "unit_snapshot as unit", "status", "approval_status as approvalStatus"),
    diaryEntries: (projectId: string, buildingId: string | null) => db("daily_log_entries as e").where("e.project_id", projectId)
      .modify((query) => { if (buildingId) query.where("e.building_id", buildingId); })
      .whereNotExists(db("daily_log_entry_voids as v").whereRaw("v.entry_id = e.id"))
      .orderBy("e.created_at", "desc").limit(100).select<MessagingDiaryTarget[]>("e.id", "e.building_id as buildingId", "e.log_date as logDate",
        "e.author_id as authorId", "e.author_name as authorName", db.raw("left(coalesce(e.body_text, ''), 160) as snippet")),
    documentVersions: (projectId: string) => db("document_versions as v").join("project_documents as d", "d.id", "v.document_id")
      .where("d.project_id", projectId).orderBy("v.version_no", "desc").limit(200)
      .select<VoiceOption[]>("v.id as value", db.raw("v.file_name || ' — version ' || v.version_no::text as label"), "v.document_id as parentId"),
    ownFiles: (projectId: string, userId: string) => db("uploaded_files").where({ project_id: projectId, owner_id: userId })
      .whereNotExists(db("messaging_agent_inbox as source").where("source.source_kind", "voice_translation").whereRaw("source.source_file_id = uploaded_files.id"))
      .orderBy("created_at", "desc").limit(100).select<VoiceOption[]>("id as value", "file_name as label"),
  };
}
