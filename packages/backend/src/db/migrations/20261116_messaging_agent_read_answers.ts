import type { Knex } from "knex";

export async function up(db: Knex): Promise<void> {
  await db.schema.alterTable("messaging_agent_inbox", (table) => table.jsonb("read_access"));
}

export async function down(db: Knex): Promise<void> {
  if (await db("messaging_agent_inbox").whereNotNull("read_access").first("id")) throw new Error("Cannot remove permission provenance while messaging read answers exist");
  await db.schema.alterTable("messaging_agent_inbox", (table) => table.dropColumn("read_access"));
}
