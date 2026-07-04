import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("rfis", (table) => {
    table.text("ball_in_court_name");
    table.text("ball_in_court_email");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("rfis", (table) => {
    table.dropColumn("ball_in_court_email");
    table.dropColumn("ball_in_court_name");
  });
}
