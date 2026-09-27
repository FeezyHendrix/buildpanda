import type { Knex } from "knex";

/**
 * A delivery is a goods-received event, not a status: a quantity signed for on
 * a date against a delivery note by a named receiver. One delivery closes (or
 * part-closes) the order, books the stock in the materials ledger and — when
 * the order carries a rate — books the cost on the order's phase. A rejected
 * load (failed CBR, wrong grade) is recorded as a delivery too, with
 * `rejected = true`, so it counts against the supplier and never against stock.
 *
 * The ledger gains the fields a GRN needs to be auditable: which supplier it
 * came from and which delivery note it was signed on. `occurred_at` is already
 * the date the movement happened; `self_approved` records the maker/checker
 * breach rather than forbidding it.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("material_deliveries", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table
      .text("order_id")
      .notNullable()
      .references("id")
      .inTable("material_orders")
      .onDelete("CASCADE");
    table.decimal("delivered_qty", 14, 2).notNullable();
    table.text("delivered_at").notNullable();
    table.text("delivery_note");
    table.text("received_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.text("notes");
    table.boolean("rejected").notNullable().defaultTo(false);
    table.text("rejected_reason");
    table.text("ledger_entry_id").references("id").inTable("material_ledger_entries").onDelete("SET NULL");
    table.text("transaction_id").references("id").inTable("project_transactions").onDelete("SET NULL");
    table.text("created_by_id").references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "order_id"]);
    table.index(["order_id", "delivered_at"]);
  });
  await knex.raw(
    "ALTER TABLE material_deliveries ADD CONSTRAINT material_deliveries_qty_positive CHECK (delivered_qty > 0)",
  );
  await knex.raw(
    "ALTER TABLE material_deliveries ADD CONSTRAINT material_deliveries_rejection_reason CHECK (rejected = false OR rejected_reason IS NOT NULL)",
  );

  await knex.schema.alterTable("material_ledger_entries", (table) => {
    table.text("supplier");
    table.text("delivery_note");
    table.boolean("self_approved").notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("material_ledger_entries", (table) => {
    table.dropColumn("self_approved");
    table.dropColumn("delivery_note");
    table.dropColumn("supplier");
  });
  await knex.schema.dropTableIfExists("material_deliveries");
}
