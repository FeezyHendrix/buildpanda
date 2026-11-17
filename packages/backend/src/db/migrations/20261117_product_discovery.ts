import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("product_discovery_responses", (t) => {
    t.text("id").primary();
    t.text("user_id").notNullable().unique().references("id").inTable("user").onDelete("CASCADE");
    t.jsonb("use_cases").notNullable().defaultTo("[]");
    t.jsonb("referral_sources").notNullable().defaultTo("[]");
    t.jsonb("current_tools").notNullable().defaultTo("[]");
    t.text("role");
    t.text("team_size");
    t.text("active_projects");
    // Null means the user closed the survey before the last question.
    t.timestamp("completed_at", { useTz: true });
    t.timestamp("demo_booked_at", { useTz: true });
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("product_discovery_responses");
}
