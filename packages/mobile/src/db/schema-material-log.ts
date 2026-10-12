import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * The material ledger: every delivery received and every quantity used,
 * append-only. A movement logged with no signal lands here first and is pushed
 * with its local id as the idempotency key, so a retried push never books the
 * same delivery twice. Quantities are `real` — part-bags and part-tonnes are
 * ordinary on site.
 */
export const materialLedgerEntries = sqliteTable(
  "material_ledger_entries",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    entryType: text("entry_type").notNull(),
    status: text("status").notNull().default("Posted"),
    materialName: text("material_name").notNull(),
    unit: text("unit").notNull(),
    quantity: real("quantity").notNull(),
    stageId: text("stage_id"),
    stageName: text("stage_name"),
    approvalStatus: text("approval_status").notNull().default("Pending"),
    occurredAt: text("occurred_at").notNull(),
    negativeStock: integer("negative_stock", { mode: "boolean" }).notNull().default(false),
    loggedByName: text("logged_by_name"),
    notesHtml: text("notes_html"),
    isPendingSync: integer("is_pending_sync", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("material_ledger_project_idx").on(table.projectId, table.occurredAt)],
);

/**
 * Stock on hand per material, as the server last worked it out. Movements
 * still in the outbox are added on top when the screen reads it.
 */
export const materialStock = sqliteTable(
  "material_stock",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    materialName: text("material_name").notNull(),
    unit: text("unit").notNull(),
    locationKey: text("location_key").notNull().default("default"),
    onHandQty: real("on_hand_qty").notNull().default(0),
    lowStock: integer("low_stock", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [index("material_stock_project_idx").on(table.projectId)],
);

export type MaterialLedgerEntryRow = typeof materialLedgerEntries.$inferSelect;
export type MaterialStockRow = typeof materialStock.$inferSelect;
