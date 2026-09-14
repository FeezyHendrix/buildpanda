import type { Knex } from "knex";

const CADENCES = ["off", "daily", "weekly", "both"] as const;

function check(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("projects", (table) => {
    table.text("ai_update_cadence").notNullable().defaultTo("weekly");
  });

  // Carry the old boolean across before dropping it: a project that had AI
  // drafts switched on keeps the weekly homeowner update it was already
  // getting, and one that opted out gets nothing until someone opts back in.
  await knex("projects")
    .where("ai_updates_enabled", false)
    .update({ ai_update_cadence: "off" });

  await knex.raw(
    `ALTER TABLE projects ADD CONSTRAINT projects_ai_update_cadence_check CHECK (ai_update_cadence IN (${check(CADENCES)}))`,
  );

  await knex.schema.alterTable("projects", (table) => {
    table.dropColumn("ai_updates_enabled");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("projects", (table) => {
    table.boolean("ai_updates_enabled").notNullable().defaultTo(true);
  });

  await knex("projects")
    .where("ai_update_cadence", "off")
    .update({ ai_updates_enabled: false });

  await knex.raw(
    "ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_ai_update_cadence_check",
  );

  await knex.schema.alterTable("projects", (table) => {
    table.dropColumn("ai_update_cadence");
  });
}
