import type { Knex } from "knex";

const PURCHASE_ORDER_STATUSES = [
  "Draft",
  "Issued",
  "PartiallyReceived",
  "Received",
  "Closed",
  "Cancelled",
] as const;

function check(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(", ");
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("purchase_orders", (table) => {
    table.text("id").primary();
    table.text("project_id").notNullable().references("id").inTable("projects").onDelete("CASCADE");
    table.text("po_number").notNullable();
    table.text("vendor_name").notNullable();
    table.text("status").notNullable().defaultTo("Draft");
    table.text("order_date");
    table.text("expected_date");
    table.text("notes");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["project_id", "created_at"]);
  });
  await knex.raw(
    `ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check CHECK (status IN (${check(PURCHASE_ORDER_STATUSES)}))`,
  );

  await knex.schema.createTable("purchase_order_items", (table) => {
    table.text("id").primary();
    table
      .text("purchase_order_id")
      .notNullable()
      .references("id")
      .inTable("purchase_orders")
      .onDelete("CASCADE");
    table.text("description").notNullable();
    table.decimal("quantity", 14, 2).notNullable().defaultTo(1);
    table.decimal("unit_price", 14, 2).notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["purchase_order_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("purchase_order_items");
  await knex.schema.dropTableIfExists("purchase_orders");
}
