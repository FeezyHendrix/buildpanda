import type { Knex } from "knex";

/**
 * The contract frame every schedule figure is measured against: when the works
 * commenced, the completion date in the contract, the revised completion date
 * once extensions of time are awarded, who the parties are, and the working
 * calendar the site actually keeps.
 *
 * Without the calendar, "working days missed" and "duration" are guesses — a
 * six-day civils week and a public holiday are project facts, not constants.
 * `working_days` holds day-of-week numbers (0 = Sunday … 6 = Saturday) and
 * defaults to Mon–Sat; `holidays` is a list of `yyyy-mm-dd` shutdown dates.
 */

const PROJECT_TYPES = ["building", "renovation", "civil", "other"] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("projects", (table) => {
    table.date("start_date");
    table.date("completion_date");
    table.date("revised_completion_date");
    table.text("client_name");
    table.text("contractor_entity");
    table.text("project_type");
    table.jsonb("working_days").notNullable().defaultTo(JSON.stringify([1, 2, 3, 4, 5, 6]));
    table.jsonb("holidays").notNullable().defaultTo("[]");
  });
  await knex.raw(
    `ALTER TABLE projects ADD CONSTRAINT projects_project_type_check
     CHECK (project_type IS NULL OR project_type IN (${PROJECT_TYPES.map((t) => `'${t}'`).join(", ")}))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_type_check");
  await knex.schema.alterTable("projects", (table) => {
    table.dropColumn("holidays");
    table.dropColumn("working_days");
    table.dropColumn("project_type");
    table.dropColumn("contractor_entity");
    table.dropColumn("client_name");
    table.dropColumn("revised_completion_date");
    table.dropColumn("completion_date");
    table.dropColumn("start_date");
  });
}
