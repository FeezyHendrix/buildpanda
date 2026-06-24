import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("platform_settings", (table) => {
    table.jsonb("feature_flags").notNullable().defaultTo("{}");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("platform_settings", (table) => {
    table.dropColumn("feature_flags");
  });
}
