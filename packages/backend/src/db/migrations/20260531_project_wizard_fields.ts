import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("projects", (table) => {
    table.decimal("budget_min", 14, 2);
    table.decimal("budget_max", 14, 2);
    table.jsonb("setup");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("projects", (table) => {
    table.dropColumn("setup");
    table.dropColumn("budget_max");
    table.dropColumn("budget_min");
  });
}
