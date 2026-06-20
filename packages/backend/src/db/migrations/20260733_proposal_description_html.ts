import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("estimate_items", (table) => {
    table.text("description_html");
  });
  await knex.schema.alterTable("estimate_payment_schedule", (table) => {
    table.text("description_html");
  });
  await knex.schema.alterTable("proposal_boq_items", (table) => {
    table.text("description_html");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("proposal_boq_items", (table) => {
    table.dropColumn("description_html");
  });
  await knex.schema.alterTable("estimate_payment_schedule", (table) => {
    table.dropColumn("description_html");
  });
  await knex.schema.alterTable("estimate_items", (table) => {
    table.dropColumn("description_html");
  });
}
