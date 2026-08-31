import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Local mirror of the server, following the sync columns Ernest uses:
 *
 * - `isPendingSync`      row is in the outbox, not yet accepted by the server
 * - `serverLastSyncedAt` null = never synced (a create), non-null = an update
 * - `deletedAt`          soft delete, so a tombstone can still be pushed
 *
 * A pull must never clobber a row with local edits, so every upsert from the
 * server is guarded on `isPendingSync = 0`.
 */
export const rfis = sqliteTable(
  "rfis",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    number: integer("number").notNull().default(0),
    subject: text("subject").notNull(),
    question: text("question").notNull(),
    status: text("status").notNull().default("Draft"),
    priority: text("priority").notNull().default("Normal"),
    ballInCourtName: text("ball_in_court_name"),
    dueDate: text("due_date"),
    officialResponse: text("official_response"),
    costImpact: integer("cost_impact", { mode: "boolean" }).notNull().default(false),
    scheduleImpact: integer("schedule_impact", { mode: "boolean" }).notNull().default(false),
    isPendingSync: integer("is_pending_sync", { mode: "boolean" }).notNull().default(false),
    serverLastSyncedAt: integer("server_last_synced_at"),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    deletedAt: integer("deleted_at"),
  },
  (table) => [index("rfis_project_idx").on(table.projectId, table.updatedAt)],
);

/**
 * RFI comments, local-first.
 *
 * A comment typed with no signal is a real record the crew member expects to
 * survive, so it lands here with `isPendingSync` and is pushed by the outbox.
 */
export const rfiComments = sqliteTable(
  "rfi_comments",
  {
    id: text("id").primaryKey(),
    rfiId: text("rfi_id").notNull(),
    projectId: text("project_id").notNull(),
    authorName: text("author_name").notNull().default(""),
    body: text("body").notNull(),
    contentHtml: text("content_html"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    isPendingSync: integer("is_pending_sync", { mode: "boolean" }).notNull().default(false),
    serverLastSyncedAt: integer("server_last_synced_at"),
  },
  (table) => [index("rfi_comments_rfi_idx").on(table.rfiId, table.createdAt)],
);

/** Server-owned document metadata, cached so the list opens with no signal. */
export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    fileName: text("file_name").notNull(),
    size: text("size").notNull().default(""),
    category: text("category"),
    /** "plan" | "document" — the backend's CategoryGroup. */
    group: text("group").notNull().default("document"),
    status: text("status"),
    versionNo: integer("version_no").notNull().default(1),
    currentVersionId: text("current_version_id"),
    uploadedAt: text("uploaded_at"),
    /** Local file URI once the blob has been downloaded for offline use. */
    localUri: text("local_uri"),
    lastAccessedAt: integer("last_accessed_at"),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("documents_project_idx").on(table.projectId, table.group)],
);

/**
 * Durable queue of local mutations. Stores the entity reference rather than a
 * frozen request body so the payload is rebuilt at send time — a body
 * serialised before a validation rule tightened would otherwise 4xx forever.
 */
export const outbox = sqliteTable(
  "outbox",
  {
    id: text("id").primaryKey(),
    resource: text("resource").notNull(),
    entityId: text("entity_id").notNull(),
    projectId: text("project_id").notNull(),
    operation: text("operation").notNull(),
    /** Server `updatedAt` this edit was based on, for conditional writes. */
    baseUpdatedAt: integer("base_updated_at"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at").notNull().default(0),
    lastError: text("last_error"),
    status: text("status").notNull().default("pending"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("outbox_status_idx").on(table.status, table.nextAttemptAt)],
);

/**
 * Daily logs are keyed by (project, date) rather than an id — one log per day —
 * so the local primary key is the composite, and there is never a "local_" row
 * to reconcile the way RFIs need.
 */
export const dailyLogs = sqliteTable(
  "daily_logs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    logDate: text("log_date").notNull(),
    totalHours: integer("total_hours").notNull().default(0),
    summary: text("summary"),
    voidedAt: text("voided_at"),
    isPendingSync: integer("is_pending_sync", { mode: "boolean" }).notNull().default(false),
    serverLastSyncedAt: integer("server_last_synced_at"),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("daily_logs_project_idx").on(table.projectId, table.logDate)],
);

/**
 * Work logged against an activity for a day — the core of the report.
 *
 * Hours are per activity, not per person; `delayReasonCode` records why work
 * was blocked, reusing the seeded delay_reasons the rest of BuildPanda uses.
 */
export const dailyLogActivities = sqliteTable(
  "daily_log_activities",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    logDate: text("log_date").notNull(),
    activityId: text("activity_id").notNull(),
    activityName: text("activity_name").notNull().default(""),
    hoursLogged: integer("hours_logged").notNull().default(0),
    delayReasonCode: text("delay_reason_code"),
    delayNote: text("delay_note"),
    isPendingSync: integer("is_pending_sync", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("daily_log_activities_day_idx").on(table.projectId, table.logDate)],
);

/** Narrative entries on a day's log; append-only, so they merge by union. */
export const dailyLogEntries = sqliteTable(
  "daily_log_entries",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    logDate: text("log_date").notNull(),
    authorName: text("author_name").notNull().default(""),
    bodyText: text("body_text").notNull().default(""),
    bodyHtml: text("body_html"),
    voided: integer("voided", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    isPendingSync: integer("is_pending_sync", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [index("daily_log_entries_day_idx").on(table.projectId, table.logDate)],
);

/** Document category folders, cached so the browser opens with no signal. */
export const documentCategories = sqliteTable(
  "document_categories",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    name: text("name").notNull(),
    fileCount: integer("file_count").notNull().default(0),
    totalSize: text("total_size").notNull().default(""),
    tone: text("tone").notNull().default("brand"),
    group: text("group").notNull().default("document"),
  },
  (table) => [index("document_categories_project_idx").on(table.projectId, table.group)],
);

export const changeRequests = sqliteTable(
  "change_requests",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    descriptionHtml: text("description_html"),
    reason: text("reason"),
    status: text("status").notNull().default("Draft"),
    costImpact: integer("cost_impact").notNull().default(0),
    timeImpactDays: integer("time_impact_days").notNull().default(0),
    currency: text("currency").notNull().default("NGN"),
    isPendingSync: integer("is_pending_sync", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("change_requests_project_idx").on(table.projectId, table.updatedAt)],
);

export const lookAheads = sqliteTable(
  "look_aheads",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("Draft"),
    startDate: text("start_date").notNull().default(""),
    endDate: text("end_date").notNull().default(""),
    totalWorkers: integer("total_workers"),
    isPendingSync: integer("is_pending_sync", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("look_aheads_project_idx").on(table.projectId, table.updatedAt)],
);

export const materialOrders = sqliteTable(
  "material_orders",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    title: text("title").notNull(),
    materialName: text("material_name").notNull().default(""),
    quantity: integer("quantity").notNull().default(0),
    unit: text("unit").notNull().default(""),
    supplier: text("supplier"),
    status: text("status").notNull().default("Draft"),
    isPendingSync: integer("is_pending_sync", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("material_orders_project_idx").on(table.projectId, table.updatedAt)],
);

/** Per-feature, per-project pull cursor — Ernest's `featurePullSyncs`. */
export const featurePullSyncs = sqliteTable("feature_pull_syncs", {
  id: text("id").primaryKey(),
  feature: text("feature").notNull(),
  projectId: text("project_id").notNull(),
  lastSyncedAt: integer("last_synced_at"),
});

export type RfiRow = typeof rfis.$inferSelect;
export type NewRfiRow = typeof rfis.$inferInsert;
export type OutboxRow = typeof outbox.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type RfiCommentRow = typeof rfiComments.$inferSelect;
export type DocumentCategoryRow = typeof documentCategories.$inferSelect;
export type DailyLogRow = typeof dailyLogs.$inferSelect;
export type DailyLogEntryRow = typeof dailyLogEntries.$inferSelect;
export type DailyLogActivityRow = typeof dailyLogActivities.$inferSelect;
export type ChangeRequestRow = typeof changeRequests.$inferSelect;
export type LookAheadRow = typeof lookAheads.$inferSelect;
export type MaterialOrderRow = typeof materialOrders.$inferSelect;
