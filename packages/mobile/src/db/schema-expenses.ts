import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * The project's expense log. An expense is a record of money spent off the
 * platform; nothing here moves money. A receipt photographed with no signal
 * is staged on disk (`receiptStagedUri`) and uploaded just before the expense.
 */
export const expenses = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    categoryLabel: text("category_label").notNull().default(""),
    amount: real("amount").notNull(),
    transactedAt: text("transacted_at").notNull(),
    vendor: text("vendor"),
    stageId: text("stage_id"),
    stageName: text("stage_name"),
    credit: integer("credit", { mode: "boolean" }).notNull().default(false),
    receiptFileId: text("receipt_file_id"),
    receiptStagedUri: text("receipt_staged_uri"),
    receiptMimeType: text("receipt_mime_type"),
    createdById: text("created_by_id"),
    createdByName: text("created_by_name"),
    isPendingSync: integer("is_pending_sync", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("expenses_project_idx").on(table.projectId, table.transactedAt)],
);

export type ExpenseRow = typeof expenses.$inferSelect;
