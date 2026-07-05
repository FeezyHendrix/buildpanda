import type { Knex } from "knex";

// AI-drafted weekly homeowner updates: a draft is hidden from project
// participants (homeowners) until the builder publishes it. generated_kind
// marks machine-generated updates (e.g. "weekly") so the generator can
// dedupe within a week without relying on title conventions.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_updates", (table) => {
    table.boolean("is_draft").notNullable().defaultTo(false);
    table.text("generated_kind");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_updates", (table) => {
    table.dropColumn("is_draft");
    table.dropColumn("generated_kind");
  });
}
