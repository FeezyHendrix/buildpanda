import type { Knex } from "knex";

/**
 * A purchase order moves through actions, never through a free status edit: it
 * is issued to a vendor on a date by a named person, received line by line,
 * cancelled with a reason or closed. Receiving more than was ordered is a real
 * event (an extra load tipped on site), so it is recorded and flagged rather
 * than refused or hidden by rewriting the ordered quantity.
 *
 * PO numbers are unique per project so "PO-IS2-002" means one order, and are
 * sequenced automatically when the raiser leaves the field blank.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("purchase_orders", (table) => {
    table.text("supplier_id").references("id").inTable("suppliers").onDelete("SET NULL");
    table
      .text("material_order_id")
      .references("id")
      .inTable("material_orders")
      .onDelete("SET NULL");
    table.text("issued_at");
    table.text("issued_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("cancel_reason");
    table.text("cancelled_at");
    table.text("closed_at");
    table.boolean("over_receipt").notNullable().defaultTo(false);
    table.index(["material_order_id"]);
  });

  await knex.schema.alterTable("purchase_order_items", (table) => {
    table.decimal("received_quantity", 14, 2).notNullable().defaultTo(0);
  });

  // Existing data may hold duplicates typed by hand; make them unique before
  // the constraint bites rather than failing the migration on a real project.
  const duplicates = await knex("purchase_orders as po")
    .join("purchase_orders as other", function () {
      this.on("other.project_id", "po.project_id")
        .andOn("other.po_number", "po.po_number")
        .andOn("other.created_at", "<", "po.created_at");
    })
    .select("po.id", "po.po_number");
  for (const row of duplicates as Array<{ id: string; po_number: string }>) {
    await knex("purchase_orders")
      .where({ id: row.id })
      .update({ po_number: `${row.po_number}-${row.id.slice(-6)}` });
  }

  await knex.raw(
    "CREATE UNIQUE INDEX purchase_orders_number_unique ON purchase_orders (project_id, po_number)",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP INDEX IF EXISTS purchase_orders_number_unique");
  await knex.schema.alterTable("purchase_order_items", (table) => {
    table.dropColumn("received_quantity");
  });
  await knex.schema.alterTable("purchase_orders", (table) => {
    table.dropIndex(["material_order_id"]);
    table.dropColumn("over_receipt");
    table.dropColumn("closed_at");
    table.dropColumn("cancelled_at");
    table.dropColumn("cancel_reason");
    table.dropColumn("issued_by_id");
    table.dropColumn("issued_at");
    table.dropColumn("material_order_id");
    table.dropColumn("supplier_id");
  });
}
