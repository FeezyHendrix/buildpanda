import type { Knex } from "knex";

/**
 * Pay-application (AIA G702/G703) lines: an invoice can bill against Build
 * Stages by period. Each line snapshots the stage's scheduled value and records
 * what is billed this application (this_period), materials stored, and retention
 * withheld. "Billed in previous applications" is derived from earlier lines, not
 * stored. Money is logged, not transacted.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("invoice_stage_lines", (table) => {
    table.text("id").primary();
    table
      .text("project_id")
      .notNullable()
      .references("id")
      .inTable("projects")
      .onDelete("CASCADE");
    table
      .text("invoice_id")
      .notNullable()
      .references("id")
      .inTable("project_invoices")
      .onDelete("CASCADE");
    table
      .text("stage_id")
      .notNullable()
      .references("id")
      .inTable("project_phases")
      .onDelete("CASCADE");
    table.decimal("scheduled_value", 14, 2).notNullable().defaultTo(0);
    table.decimal("this_period", 14, 2).notNullable().defaultTo(0);
    table.decimal("stored_materials", 14, 2).notNullable().defaultTo(0);
    table.decimal("retained", 14, 2).notNullable().defaultTo(0);
    table.integer("sort_order").notNullable().defaultTo(0);
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.unique(["invoice_id", "stage_id"]);
    table.index(["invoice_id"]);
    table.index(["project_id", "stage_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("invoice_stage_lines");
}
