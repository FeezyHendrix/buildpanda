import type { Knex } from "knex";

export async function up(db: Knex): Promise<void> {
  await db.schema.createTable("whatsapp_identity_links", (t) => {
    t.text("id").primary();
    t.text("business_phone_number_id").notNullable();
    t.text("sender_id").notNullable();
    t.text("user_id").notNullable().references("id").inTable("user").onDelete("CASCADE");
    t.timestamp("opted_out_at", { useTz: true });
    t.timestamp("revoked_at", { useTz: true });
    t.timestamp("last_inbound_at", { useTz: true });
    t.timestamps(true, true);
    t.index(["user_id", "revoked_at"]);
  });
  await db.raw("CREATE UNIQUE INDEX whatsapp_active_sender_unique ON whatsapp_identity_links (business_phone_number_id, sender_id) WHERE revoked_at IS NULL");

  await db.schema.createTable("whatsapp_link_codes", (t) => {
    t.text("id").primary();
    t.text("user_id").notNullable().references("id").inTable("user").onDelete("CASCADE");
    t.text("organization_id").references("id").inTable("organization").onDelete("CASCADE");
    t.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    t.text("building_id").notNullable().references("id").inTable("buildings").onDelete("CASCADE");
    t.string("code_hash", 64).notNullable().unique();
    t.timestamp("expires_at", { useTz: true }).notNullable();
    t.timestamp("consumed_at", { useTz: true });
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(db.fn.now());
    t.index(["user_id", "expires_at"]);
  });

  await db.schema.createTable("whatsapp_conversations", (t) => {
    t.text("id").primary();
    t.text("identity_id").notNullable().unique().references("id").inTable("whatsapp_identity_links").onDelete("CASCADE");
    t.text("organization_id").references("id").inTable("organization").onDelete("CASCADE");
    t.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    t.text("building_id").notNullable().references("id").inTable("buildings").onDelete("CASCADE");
    t.integer("scope_version").notNullable().defaultTo(1).checkPositive();
    t.boolean("paused").notNullable().defaultTo(false);
    t.timestamps(true, true);
  });

  await db.schema.createTable("whatsapp_inbox", (t) => {
    t.text("id").primary();
    t.text("business_phone_number_id").notNullable();
    t.text("provider_message_id").notNullable();
    t.text("sender_id").notNullable();
    t.text("identity_id").references("id").inTable("whatsapp_identity_links").onDelete("SET NULL");
    t.text("conversation_id").references("id").inTable("whatsapp_conversations").onDelete("CASCADE");
    t.text("organization_id").references("id").inTable("organization").onDelete("CASCADE");
    t.text("project_id").references("id").inTable("projects").onDelete("CASCADE");
    t.text("building_id").references("id").inTable("buildings").onDelete("CASCADE");
    t.integer("scope_version").checkPositive();
    t.text("message_type").notNullable().checkIn(["text", "audio", "unsupported"]);
    t.text("source_text");
    t.string("link_code_hash", 64);
    t.text("source_kind").notNullable().checkIn(["text", "voice_translation"]);
    t.text("source_file_id").references("id").inTable("uploaded_files").onDelete("SET NULL");
    t.text("media_id");
    t.text("media_mime_type");
    t.text("reply_to_message_id");
    t.timestamp("sent_at", { useTz: true }).notNullable();
    t.text("status").notNullable().defaultTo("received").checkIn(["received", "processing", "processed", "failed"]);
    t.integer("attempts").notNullable().defaultTo(0);
    t.timestamp("processing_started_at", { useTz: true });
    t.text("last_error");
    t.timestamps(true, true);
    t.unique(["business_phone_number_id", "provider_message_id"]);
    t.index(["status", "created_at"]);
    t.check("attempts >= 0");
  });

  await db.schema.createTable("whatsapp_proposals", (t) => {
    t.text("id").primary();
    t.text("conversation_id").notNullable().references("id").inTable("whatsapp_conversations").onDelete("CASCADE");
    t.text("inbox_id").notNullable().unique().references("id").inTable("whatsapp_inbox").onDelete("CASCADE");
    t.text("organization_id").references("id").inTable("organization").onDelete("CASCADE");
    t.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    t.text("building_id").notNullable().references("id").inTable("buildings").onDelete("CASCADE");
    t.integer("scope_version").notNullable().checkPositive();
    t.integer("version").notNullable().defaultTo(1).checkPositive();
    t.text("status").notNullable().defaultTo("draft").checkIn(["draft", "confirmed", "completed", "cancelled"]);
    t.text("source_text").notNullable();
    t.text("source_kind").notNullable().checkIn(["text", "voice_translation"]);
    t.text("source_file_id").references("id").inTable("uploaded_files").onDelete("SET NULL");
    t.timestamp("confirmed_at", { useTz: true });
    t.timestamps(true, true);
    t.index(["conversation_id", "status", "created_at"]);
  });

  await db.schema.createTable("whatsapp_actions", (t) => {
    t.text("id").primary();
    t.text("proposal_id").notNullable().references("id").inTable("whatsapp_proposals").onDelete("CASCADE");
    t.integer("proposal_version").notNullable().checkPositive();
    t.integer("position").notNullable();
    t.text("kind").notNullable();
    t.text("title");
    t.text("summary");
    t.jsonb("payload").notNullable();
    t.text("status").notNullable().defaultTo("proposed").checkIn(["proposed", "committed", "failed"]);
    t.jsonb("result");
    t.text("last_error");
    t.timestamps(true, true);
    t.unique(["proposal_id", "proposal_version", "position"]);
    t.check("position >= 0");
  });

  await db.schema.createTable("whatsapp_outbox", (t) => {
    t.text("id").primary();
    t.text("inbox_id").notNullable().references("id").inTable("whatsapp_inbox").onDelete("CASCADE");
    t.text("identity_id").references("id").inTable("whatsapp_identity_links").onDelete("CASCADE");
    t.text("conversation_id").references("id").inTable("whatsapp_conversations").onDelete("CASCADE");
    t.text("recipient_id").notNullable();
    t.text("body").notNullable();
    t.integer("scope_version");
    t.text("idempotency_key").notNullable().unique();
    t.text("status").notNullable().defaultTo("pending").checkIn(["pending", "sending", "accepted", "sent", "delivered", "read", "failed", "unknown", "cancelled"]);
    t.integer("attempts").notNullable().defaultTo(0);
    t.text("provider_message_id").unique();
    t.text("last_error");
    t.timestamp("sending_started_at", { useTz: true });
    t.timestamps(true, true);
    t.index(["status", "created_at"]);
    t.check("attempts >= 0");
  });
}

export async function down(db: Knex): Promise<void> {
  for (const name of ["whatsapp_outbox", "whatsapp_actions", "whatsapp_proposals", "whatsapp_inbox", "whatsapp_conversations", "whatsapp_link_codes", "whatsapp_identity_links"]) {
    await db.schema.dropTable(name);
  }
}
