import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("project_ai_insights", (table) => {
    table.text("id").primary();
    table
      .text("project_id")
      .notNullable()
      .references("id")
      .inTable("projects")
      .onDelete("CASCADE");
    table.text("status").notNullable().defaultTo("pending");
    table.text("summary");
    table.jsonb("suggestions").notNullable().defaultTo("[]");
    table.jsonb("metrics");
    table.integer("health_score");
    table.text("model");
    table.text("error");
    table.text("requested_by");
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE project_ai_insights ADD CONSTRAINT project_ai_insights_status_check CHECK (status IN ('pending', 'processing', 'complete', 'failed'))`,
  );
  await knex.raw(
    `ALTER TABLE project_ai_insights ADD CONSTRAINT project_ai_insights_health_check CHECK (health_score IS NULL OR (health_score >= 0 AND health_score <= 100))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("project_ai_insights");
}
