import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("approvals", (table) => {
    table.text("description_html");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("approvals", (table) => {
    table.dropColumn("description_html");
  });
}
