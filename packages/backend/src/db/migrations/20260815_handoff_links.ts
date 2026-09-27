import type { Knex } from "knex";

// Handoff back-links: every project row that conversion creates remembers the
// pre-construction row it came from, so revisions, re-measures and variations
// can reconcile against the accepted offer instead of a one-way copy.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("projects", (table) => {
    table.text("estimate_id");
  });
  await knex.schema.alterTable("project_phases", (table) => {
    table.text("programme_task_id");
  });
  await knex.schema.alterTable("activities", (table) => {
    table.text("programme_task_id");
  });
  await knex.schema.alterTable("key_dates", (table) => {
    table.text("programme_task_id");
  });
  await knex.schema.alterTable("milestone_payments", (table) => {
    table.text("schedule_item_id");
  });
  await knex.schema.alterTable("material_orders", (table) => {
    table.text("takeoff_row_id");
    table.text("owner").notNullable().defaultTo("contractor");
  });
  await knex.raw(
    "ALTER TABLE material_orders ADD CONSTRAINT material_orders_owner_check CHECK (owner IN ('contractor', 'client'))",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE material_orders DROP CONSTRAINT IF EXISTS material_orders_owner_check");
  await knex.schema.alterTable("material_orders", (table) => {
    table.dropColumn("owner");
    table.dropColumn("takeoff_row_id");
  });
  await knex.schema.alterTable("milestone_payments", (table) => {
    table.dropColumn("schedule_item_id");
  });
  await knex.schema.alterTable("key_dates", (table) => {
    table.dropColumn("programme_task_id");
  });
  await knex.schema.alterTable("activities", (table) => {
    table.dropColumn("programme_task_id");
  });
  await knex.schema.alterTable("project_phases", (table) => {
    table.dropColumn("programme_task_id");
  });
  await knex.schema.alterTable("projects", (table) => {
    table.dropColumn("estimate_id");
  });
}
