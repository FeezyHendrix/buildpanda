import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_finances", (table) => {
    table.decimal("amount_paid_to_date", 14, 2).notNullable().defaultTo(0);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_finances", (table) => {
    table.dropColumn("amount_paid_to_date");
  });
}
