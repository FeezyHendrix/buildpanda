import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import {
  changeRequestComments,
  changeRequests,
  dailyLogActivities,
  dailyLogEntries,
  dailyLogs,
  documents,
  drawingMarkupComments,
  drawingMarkups,
  lookAheads,
  materialApprovalComments,
  materialApprovals,
  materialOrders,
  rfiComments,
  rfis,
} from "./schema";

/**
 * Which local table each outbox resource writes to. Every table here has an
 * `id` primary key and an `is_pending_sync` flag, which is all the queue needs
 * to put a record back in order when its push is discarded.
 */
export const OUTBOX_TABLES: Record<string, SQLiteTable> = {
  rfis,
  "rfi-comments": rfiComments,
  "daily-logs": dailyLogs,
  "daily-log-entries": dailyLogEntries,
  "daily-log-activities": dailyLogActivities,
  "change-requests": changeRequests,
  "change-request-comments": changeRequestComments,
  documents,
  "material-orders": materialOrders,
  "look-aheads": lookAheads,
  "material-approvals": materialApprovals,
  "material-approval-comments": materialApprovalComments,
  "drawing-markups": drawingMarkups,
  "drawing-markup-comments": drawingMarkupComments,
};
