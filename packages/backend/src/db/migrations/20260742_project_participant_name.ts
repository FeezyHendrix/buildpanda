import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_participants", (table) => {
    table.text("name");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_participants", (table) => {
    table.dropColumn("name");
  });
}
