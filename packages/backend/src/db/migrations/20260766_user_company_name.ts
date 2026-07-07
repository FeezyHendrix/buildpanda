import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("user", (table) => {
    table.text("companyName");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("user", (table) => {
    table.dropColumn("companyName");
  });
}
