import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("daily_logs", (table) => {
    table.text("summary_html");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("daily_logs", (table) => {
    table.dropColumn("summary_html");
  });
}
