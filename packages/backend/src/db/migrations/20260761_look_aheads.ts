import type { Knex } from "knex";

const STATUS = ["Draft", "UnderReview", "Approved"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("look_aheads", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("description");
    table.text("status").notNullable().defaultTo("Draft");
    table.date("start_date").notNullable();
    table.date("end_date").notNullable();
    table.integer("total_workers");
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "start_date"]);
  });
  await knex.raw(`ALTER TABLE look_aheads ADD CONSTRAINT look_aheads_status_check CHECK (status IN (${check(STATUS)}))`);

  await knex.schema.createTable("look_ahead_activities", (table) => {
    table.text("look_ahead_id").notNullable().references("id").inTable("look_aheads").onDelete("CASCADE");
    table.text("activity_id").notNullable().references("id").inTable("activities").onDelete("CASCADE");
    table.primary(["look_ahead_id", "activity_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("look_ahead_activities");
  await knex.schema.dropTableIfExists("look_aheads");
}
