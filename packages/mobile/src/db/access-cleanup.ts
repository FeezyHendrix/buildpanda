import { sql } from "drizzle-orm";
import type { Db } from "./client";

/** Keep authored, unsent records quarantined; remove server data after denial. */
export function clearProjectServerCache(db: Db, projectId: string): void {
  db.transaction((tx) => {
    for (const table of ["rfis", "rfi_comments", "documents", "daily_logs", "daily_log_entries",
      "daily_log_activities", "change_requests", "change_request_comments", "look_aheads",
      "material_orders", "material_approvals", "material_approval_comments", "drawing_markups",
      "drawing_markup_comments", "project_updates", "tasks", "expenses", "material_ledger_entries"]) {
      tx.run(sql`DELETE FROM ${sql.identifier(table)} WHERE project_id = ${projectId} AND is_pending_sync = 0`);
    }
    for (const table of ["document_categories", "task_columns", "material_stock", "daily_log_templates"]) {
      tx.run(sql`DELETE FROM ${sql.identifier(table)} WHERE project_id = ${projectId}`);
    }
    tx.run(sql`DELETE FROM project_update_media WHERE update_id NOT IN (SELECT id FROM project_updates)`);
  });
}
