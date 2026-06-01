import type { Knex } from "knex";

const STATUS = ["Upcoming", "Met", "Missed"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

/**
 * Key dates: important schedule milestones (distinct from payment milestones),
 * e.g. "Roof on", "Move-in target". Target vs actual date drives schedule
 * variance in reporting.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("key_dates", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("label").notNullable();
    table.date("target_date");
    table.date("actual_date");
    table.text("status").notNullable().defaultTo("Upcoming");
    table.text("notes");
    table.integer("sort_order").notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "target_date"]);
  });
  await knex.raw(
    `ALTER TABLE key_dates ADD CONSTRAINT key_dates_status_check CHECK (status IN (${check(STATUS)}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("key_dates");
}
