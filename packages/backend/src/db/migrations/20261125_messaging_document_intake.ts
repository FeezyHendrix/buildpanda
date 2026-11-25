import type { Knex } from "knex";

export async function up(db: Knex): Promise<void> {
  await db.schema.alterTable("uploaded_files", (table) => table.string("content_sha256", 64).nullable().index());
  await db.schema.alterTable("messaging_agent_inbox", (table) => table.jsonb("attachment_analysis").nullable());
  await db.schema.alterTable("purchase_orders", (table) => table.string("source_file_id").nullable().references("id").inTable("uploaded_files").onDelete("SET NULL"));
  await db.schema.createTable("purchase_order_receipt_files", (table) => {
    table.string("purchase_order_id").notNullable().references("id").inTable("purchase_orders").onDelete("CASCADE");
    table.string("file_id").notNullable().references("id").inTable("uploaded_files").onDelete("CASCADE");
    table.string("created_by_id").nullable().references("id").inTable("user").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(db.fn.now());
    table.primary(["purchase_order_id", "file_id"]);
  });
  await db.schema.alterTable("invoice_payments", (table) => table.string("source_file_id").nullable().references("id").inTable("uploaded_files").onDelete("SET NULL"));
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTable("purchase_order_receipt_files");
  await db.schema.alterTable("invoice_payments", (table) => table.dropColumn("source_file_id"));
  await db.schema.alterTable("purchase_orders", (table) => table.dropColumn("source_file_id"));
  await db.schema.alterTable("uploaded_files", (table) => table.dropColumn("content_sha256"));
  await db.schema.alterTable("messaging_agent_inbox", (table) => table.dropColumn("attachment_analysis"));
}
