import type { Knex } from "knex";

const suffixes = ["identity_links", "link_codes", "conversations", "inbox", "proposals", "actions", "outbox"] as const;

export async function up(db: Knex): Promise<void> {
  await db.raw("DROP INDEX whatsapp_active_sender_unique");
  await db.schema.alterTable("whatsapp_inbox", (t) => t.dropUnique(["business_phone_number_id", "provider_message_id"]));
  await db.schema.alterTable("whatsapp_outbox", (t) => t.dropUnique(["provider_message_id"]));
  for (const suffix of suffixes) await db.schema.renameTable(`whatsapp_${suffix}`, `messaging_agent_${suffix}`);
  for (const suffix of ["identity_links", "inbox"] as const) {
    const table = `messaging_agent_${suffix}`;
    await db.schema.alterTable(table, (t) => {
      t.renameColumn("business_phone_number_id", "channel_account_id");
      t.text("channel").notNullable().defaultTo("whatsapp");
    });
    await db.raw("ALTER TABLE ?? ALTER COLUMN channel DROP DEFAULT", [table]);
  }
  await db.schema.alterTable("messaging_agent_link_codes", (t) => {
    t.text("channel").notNullable().defaultTo("whatsapp");
    // Old codes were never account-bound. Preserve them without making them redeemable on another account.
    t.text("channel_account_id").notNullable().defaultTo("legacy-unbound");
  });
  await db("messaging_agent_link_codes").whereNull("consumed_at").where("expires_at", ">", db.fn.now()).update({ expires_at: db.fn.now() });
  await db.schema.alterTable("messaging_agent_inbox", (t) => {
    t.text("reply_recipient_id");
    t.text("conversation_type").notNullable().defaultTo("direct").checkIn(["direct", "group"]);
    t.text("origin").notNullable().defaultTo("provider").checkIn(["provider", "web"]);
  });
  await db.raw("UPDATE messaging_agent_inbox SET reply_recipient_id = sender_id");
  await db("messaging_agent_inbox").where("provider_message_id", "like", "web:%").update({ origin: "web" });
  await db.schema.alterTable("messaging_agent_inbox", (t) => t.text("reply_recipient_id").notNullable().alter());
  await db.raw("ALTER TABLE messaging_agent_inbox ALTER COLUMN conversation_type DROP DEFAULT");
  await db.raw("ALTER TABLE messaging_agent_link_codes ALTER COLUMN channel DROP DEFAULT, ALTER COLUMN channel_account_id DROP DEFAULT");
  await db.schema.alterTable("messaging_agent_outbox", (t) => {
    t.text("channel");
    t.text("channel_account_id");
  });
  await db.raw(`UPDATE messaging_agent_outbox AS o SET channel = i.channel, channel_account_id = i.channel_account_id
    FROM messaging_agent_inbox AS i WHERE i.id = o.inbox_id`);
  await db.schema.alterTable("messaging_agent_outbox", (t) => {
    t.text("channel").notNullable().alter();
    t.text("channel_account_id").notNullable().alter();
    t.unique(["channel", "channel_account_id", "provider_message_id"], { indexName: "messaging_agent_outbox_provider_unique" });
  });
  await db.raw("CREATE UNIQUE INDEX messaging_agent_active_sender_unique ON messaging_agent_identity_links (channel, channel_account_id, sender_id) WHERE revoked_at IS NULL");
  await db.schema.alterTable("messaging_agent_inbox", (t) => t.unique(["channel", "channel_account_id", "origin", "provider_message_id"], { indexName: "messaging_agent_inbox_provider_unique" }));
}

export async function down(db: Knex): Promise<void> {
  for (const suffix of ["identity_links", "link_codes", "inbox", "outbox"] as const) {
    if (await db(`messaging_agent_${suffix}`).whereNot("channel", "whatsapp").first("id")) {
      throw new Error("Cannot roll back messaging channels while non-WhatsApp records exist");
    }
  }
  if (await db("messaging_agent_inbox").whereNot("conversation_type", "direct").first("id")) {
    throw new Error("Cannot roll back messaging channels while group messages exist");
  }
  if (await db("messaging_agent_inbox").whereRaw("reply_recipient_id <> sender_id").first("id")) {
    throw new Error("Cannot roll back messaging channels while private reply addresses differ from sender IDs");
  }
  if (await db("messaging_agent_inbox").where((query) => query.where({ origin: "web" }).whereNot("provider_message_id", "like", "web:%"))
    .orWhere((query) => query.where({ origin: "provider" }).where("provider_message_id", "like", "web:%")).first("id")) {
    throw new Error("Cannot roll back messaging channels while message origins differ from legacy ID prefixes");
  }
  if (await db("messaging_agent_outbox").whereNotNull("provider_message_id").groupBy("provider_message_id").havingRaw("count(*) > 1").first("provider_message_id")) {
    throw new Error("Cannot roll back messaging channels while provider message IDs collide across accounts");
  }
  if (await db("messaging_agent_inbox").groupBy("channel_account_id", "provider_message_id").havingRaw("count(*) > 1").first("provider_message_id")) {
    throw new Error("Cannot roll back messaging channels while provider and web message IDs collide");
  }
  if (await db("messaging_agent_link_codes").whereNot("channel_account_id", "legacy-unbound").whereNull("consumed_at").where("expires_at", ">", db.raw("clock_timestamp()")).first("id")) {
    throw new Error("Cannot roll back messaging channels while unexpired account-bound link codes exist");
  }
  await db.raw("DROP INDEX messaging_agent_active_sender_unique");
  await db.schema.alterTable("messaging_agent_inbox", (t) => {
    t.dropUnique([], "messaging_agent_inbox_provider_unique");
    t.dropColumns("reply_recipient_id", "conversation_type", "origin");
  });
  await db.schema.alterTable("messaging_agent_outbox", (t) => {
    t.dropUnique([], "messaging_agent_outbox_provider_unique");
    t.dropColumns("channel", "channel_account_id");
  });
  await db.schema.alterTable("messaging_agent_link_codes", (t) => t.dropColumns("channel", "channel_account_id"));
  for (const suffix of ["identity_links", "inbox"] as const) {
    await db.schema.alterTable(`messaging_agent_${suffix}`, (t) => {
      t.renameColumn("channel_account_id", "business_phone_number_id");
      t.dropColumn("channel");
    });
  }
  for (const suffix of suffixes) await db.schema.renameTable(`messaging_agent_${suffix}`, `whatsapp_${suffix}`);
  await db.raw("CREATE UNIQUE INDEX whatsapp_active_sender_unique ON whatsapp_identity_links (business_phone_number_id, sender_id) WHERE revoked_at IS NULL");
  await db.schema.alterTable("whatsapp_inbox", (t) => t.unique(["business_phone_number_id", "provider_message_id"]));
  await db.schema.alterTable("whatsapp_outbox", (t) => t.unique(["provider_message_id"]));
}
