import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("rfi_comments", (table) => {
    table.text("content_html");
    table.jsonb("attachments");
    table.jsonb("references");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("rfi_comments", (table) => {
    table.dropColumn("content_html");
    table.dropColumn("attachments");
    table.dropColumn("references");
  });
}
