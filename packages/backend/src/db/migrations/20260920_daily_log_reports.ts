import type { Knex } from "knex";

const PERIODS = ["daily", "weekly", "monthly"];

function check(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(", ");
}

/**
 * A weekly report to the Resident Engineer is a contractual issue, not a view.
 * Nothing linked a downloaded report to the data it was built from, so voiding
 * an entry afterwards silently produced a different document on the next
 * download with no trace (finding F12). Each generation is now a row: who asked
 * for it, when, over what range, and what the figures were at that moment.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("daily_log_reports", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("period").notNullable();
    table.date("range_from").notNullable();
    table.date("range_to").notNullable();
    table.text("file_name").notNullable();
    table.jsonb("snapshot").notNullable().defaultTo("{}");
    table.text("generated_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("generated_by_name");
    table.timestamp("generated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "generated_at"]);
  });
  await knex.raw(
    `ALTER TABLE daily_log_reports ADD CONSTRAINT daily_log_reports_period_check CHECK (period IN (${check(PERIODS)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("daily_log_reports");
}
