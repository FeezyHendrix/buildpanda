import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("materials_catalog", (table) => {
    table.decimal("reorder_quantity", 14, 2);
    table.integer("lead_time_days");
    table.text("preferred_supplier_id").references("id").inTable("suppliers").onDelete("SET NULL");
    table.boolean("auto_reorder_enabled").notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("materials_catalog", (table) => {
    table.dropColumn("reorder_quantity");
    table.dropColumn("lead_time_days");
    table.dropColumn("preferred_supplier_id");
    table.dropColumn("auto_reorder_enabled");
  });
}
