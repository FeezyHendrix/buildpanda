import type { Knex } from "knex";

/**
 * Cost-to-stage: an expense (project_transactions) and a purchase order can
 * each be attributed to the build stage (project_phases) it belongs to, so the
 * app can answer "what has this stage cost" as committed (issued POs) and
 * actual (logged expenses). The stage is an attribution, not ownership —
 * deleting a stage un-attributes the money records rather than deleting them.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("project_transactions", (table) => {
    table.text("stage_id").nullable().references("id").inTable("project_phases").onDelete("SET NULL");
    table.index(["project_id", "stage_id"]);
  });
  await knex.schema.alterTable("purchase_orders", (table) => {
    table.text("stage_id").nullable().references("id").inTable("project_phases").onDelete("SET NULL");
    table.index(["project_id", "stage_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("purchase_orders", (table) => {
    table.dropIndex(["project_id", "stage_id"]);
    table.dropColumn("stage_id");
  });
  await knex.schema.alterTable("project_transactions", (table) => {
    table.dropIndex(["project_id", "stage_id"]);
    table.dropColumn("stage_id");
  });
}
