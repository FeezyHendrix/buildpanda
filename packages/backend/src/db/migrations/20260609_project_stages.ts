import type { Knex } from "knex";

/**
 * Promotes project_phases into first-class, manageable "Stages":
 * structured start/end dates and a progress percentage that feed the
 * schedule chart and project progress reporting. Keeps name/status/sort_order
 * and the legacy date_range (kept in sync for the Gantt) intact.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_phases", (table) => {
    table.date("start_date").nullable();
    table.date("end_date").nullable();
    table.integer("progress_percent").notNullable().defaultTo(0);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_phases", (table) => {
    table.dropColumn("start_date");
    table.dropColumn("end_date");
    table.dropColumn("progress_percent");
  });
}
