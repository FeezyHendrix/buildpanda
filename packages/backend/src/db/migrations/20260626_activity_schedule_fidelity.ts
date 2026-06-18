import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("activities", (table) => {
    table.text("wbs_code");
    table.integer("outline_level");
    table.text("parent_activity_id").references("id").inTable("activities").onDelete("SET NULL");
    table.jsonb("predecessors").notNullable().defaultTo("[]");
    table.decimal("percent_complete", 5, 2).notNullable().defaultTo(0);
    table.decimal("duration_days", 10, 2);
    table.timestamp("baseline_start_at", { useTz: true });
    table.timestamp("baseline_end_at", { useTz: true });
    table.boolean("is_milestone").notNullable().defaultTo(false);
    table.text("source").notNullable().defaultTo("manual");
  });
  await knex.raw(
    "ALTER TABLE activities ADD CONSTRAINT activities_percent_complete_check CHECK (percent_complete >= 0 AND percent_complete <= 100)",
  );
  await knex.schema.alterTable("activities", (table) => {
    table.index(["parent_activity_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_percent_complete_check");
  await knex.schema.alterTable("activities", (table) => {
    table.dropColumn("wbs_code");
    table.dropColumn("outline_level");
    table.dropColumn("parent_activity_id");
    table.dropColumn("predecessors");
    table.dropColumn("percent_complete");
    table.dropColumn("duration_days");
    table.dropColumn("baseline_start_at");
    table.dropColumn("baseline_end_at");
    table.dropColumn("is_milestone");
    table.dropColumn("source");
  });
}
