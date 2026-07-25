import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("material_orders", (table) => {
    table
      .text("invoice_id")
      .references("id")
      .inTable("project_invoices")
      .onDelete("SET NULL");
    table.text("invoice_line_item_id");
  });

  await knex.raw(
    `CREATE INDEX material_orders_invoice_id_index ON material_orders (invoice_id)`,
  );
  await knex.raw(
    `CREATE UNIQUE INDEX material_orders_invoice_line_item_id_unique
     ON material_orders (invoice_line_item_id)
     WHERE invoice_line_item_id IS NOT NULL`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("material_orders", (table) => {
    table.dropColumn("invoice_line_item_id");
    table.dropColumn("invoice_id");
  });
}
