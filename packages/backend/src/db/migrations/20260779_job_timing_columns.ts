import type { Knex } from "knex";

const JOB_TABLES = [
  "takeoff_jobs",
  "programme_import_jobs",
  "boq_import_jobs",
] as const;

export async function up(knex: Knex): Promise<void> {
  for (const name of JOB_TABLES) {
    await knex.schema.alterTable(name, (table) => {
      table.timestamp("started_at", { useTz: true }).nullable();
      table.timestamp("completed_at", { useTz: true }).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const name of JOB_TABLES) {
    await knex.schema.alterTable(name, (table) => {
      table.dropColumn("started_at");
      table.dropColumn("completed_at");
    });
  }
}
