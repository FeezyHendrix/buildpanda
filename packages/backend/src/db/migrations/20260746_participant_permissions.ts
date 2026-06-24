import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_participants", (table) => {
    table.jsonb("permissions").notNullable().defaultTo("{}");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_participants", (table) => {
    table.dropColumn("permissions");
  });
}
