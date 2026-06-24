import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("payment_ledger", (table) => {
    table.text("description_html");
  });
  await knex.schema.alterTable("delay_reasons", (table) => {
    table.text("description_html");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("delay_reasons", (table) => {
    table.dropColumn("description_html");
  });
  await knex.schema.alterTable("payment_ledger", (table) => {
    table.dropColumn("description_html");
  });
}
