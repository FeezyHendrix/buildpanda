import type { Knex } from "knex";

export async function up(db: Knex): Promise<void> {
  await db.schema.alterTable("notifications", table => table.text("cta_url").nullable());
}

export async function down(db: Knex): Promise<void> {
  await db.schema.alterTable("notifications", table => table.dropColumn("cta_url"));
}
