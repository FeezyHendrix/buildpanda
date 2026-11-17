import type { Knex } from "knex";

export async function up(db: Knex): Promise<void> {
  await db.raw("ALTER TABLE messaging_agent_inbox DROP CONSTRAINT whatsapp_inbox_message_type_check, DROP CONSTRAINT whatsapp_inbox_source_kind_check");
  await db.raw("ALTER TABLE messaging_agent_proposals DROP CONSTRAINT whatsapp_proposals_source_kind_check");
  await db.raw("ALTER TABLE messaging_agent_inbox ADD CONSTRAINT messaging_agent_inbox_message_type_check CHECK (message_type IN ('text','audio','attachment','unsupported')), ADD CONSTRAINT messaging_agent_inbox_source_kind_check CHECK (source_kind IN ('text','voice_translation','file_attachment'))");
  await db.raw("ALTER TABLE messaging_agent_proposals ADD CONSTRAINT messaging_agent_proposals_source_kind_check CHECK (source_kind IN ('text','voice_translation','file_attachment'))");
}

export async function down(db: Knex): Promise<void> {
  if (await db("messaging_agent_inbox").where({ message_type: "attachment" }).orWhere({ source_kind: "file_attachment" }).first("id")
    || await db("messaging_agent_proposals").where({ source_kind: "file_attachment" }).first("id")) {
    throw new Error("Cannot remove attachment support while original attachment records exist");
  }
  await db.raw("ALTER TABLE messaging_agent_inbox DROP CONSTRAINT messaging_agent_inbox_message_type_check, DROP CONSTRAINT messaging_agent_inbox_source_kind_check");
  await db.raw("ALTER TABLE messaging_agent_proposals DROP CONSTRAINT messaging_agent_proposals_source_kind_check");
  await db.raw("ALTER TABLE messaging_agent_inbox ADD CONSTRAINT whatsapp_inbox_message_type_check CHECK (message_type IN ('text','audio','unsupported')), ADD CONSTRAINT whatsapp_inbox_source_kind_check CHECK (source_kind IN ('text','voice_translation'))");
  await db.raw("ALTER TABLE messaging_agent_proposals ADD CONSTRAINT whatsapp_proposals_source_kind_check CHECK (source_kind IN ('text','voice_translation'))");
}
