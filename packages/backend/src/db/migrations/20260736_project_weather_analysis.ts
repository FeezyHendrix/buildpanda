import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("project_weather_analysis", (table) => {
    table.text("id").primary();
    table
      .text("project_id")
      .notNullable()
      .unique()
      .references("id")
      .inTable("projects")
      .onDelete("CASCADE");
    table.text("forecast_signature").notNullable();
    table.text("location_name");
    table.text("headline");
    table.text("impact");
    table.text("schedule_impact");
    table.text("cost_impact");
    table.jsonb("recommendations").notNullable().defaultTo("[]");
    table.text("risk_level");
    table.text("model");
    table
      .timestamp("computed_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });
  await knex.raw(
    `ALTER TABLE project_weather_analysis ADD CONSTRAINT project_weather_analysis_risk_check CHECK (risk_level IS NULL OR risk_level IN ('low', 'medium', 'high'))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("project_weather_analysis");
}
