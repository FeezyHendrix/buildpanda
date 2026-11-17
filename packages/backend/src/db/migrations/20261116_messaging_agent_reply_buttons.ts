import type { Knex } from "knex";

export async function up(db: Knex): Promise<void> {
  await db.schema.alterTable("messaging_agent_outbox", (table) => {
    table.jsonb("buttons");
    table.check("buttons IS NULL OR jsonb_typeof(buttons) = 'array'", [], "messaging_agent_outbox_buttons_array");
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.alterTable("messaging_agent_outbox", (table) => table.dropColumn("buttons"));
}
