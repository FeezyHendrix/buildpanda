import type { Knex } from "knex";

const scopedTables = ["messaging_agent_link_codes", "messaging_agent_conversations", "messaging_agent_proposals"] as const;

export async function up(db: Knex): Promise<void> {
  for (const name of scopedTables) await db.schema.alterTable(name, (table) => table.text("building_id").nullable().alter());
  await db.schema.alterTable("messaging_agent_proposals", (table) => table.text("clarification"));
  await db.schema.alterTable("messaging_agent_conversations", (table) => table.timestamp("context_reset_at", { useTz: true }));
}

export async function down(db: Knex): Promise<void> {
  for (const name of scopedTables) if (await db(name).whereNull("building_id").first("id")) {
    throw new Error("Cannot roll back material capture while project-only messaging scopes exist");
  }
  if (await db("messaging_agent_proposals").whereNotNull("clarification").first("id")) {
    throw new Error("Cannot roll back material capture while clarification drafts exist");
  }
  await db.schema.alterTable("messaging_agent_proposals", (table) => table.dropColumn("clarification"));
  await db.schema.alterTable("messaging_agent_conversations", (table) => table.dropColumn("context_reset_at"));
  for (const name of scopedTables) await db.schema.alterTable(name, (table) => table.text("building_id").notNullable().alter());
}
