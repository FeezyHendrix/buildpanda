import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("change_requests", (table) => {
    table.text("description_html");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("change_requests", (table) => {
    table.dropColumn("description_html");
  });
}
