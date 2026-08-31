import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("drawing_markup_comments", (table) => {
    table.text("body_html");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("drawing_markup_comments", (table) => {
    table.dropColumn("body_html");
  });
}
