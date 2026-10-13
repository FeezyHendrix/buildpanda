import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Daily logs are keyed by (project, building, date) — one log per building per day —
 * so the local primary key is the composite, and there is never a "local_" row
 * to reconcile the way RFIs need.
 */
export const dailyLogs = sqliteTable(
  "daily_logs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    buildingId: text("building_id"),
    logDate: text("log_date").notNull(),
    totalHours: integer("total_hours").notNull().default(0),
    summary: text("summary"),
    weatherCondition: text("weather_condition"),
    temperatureC: real("temperature_c"),
    workersExpected: integer("workers_expected").notNull().default(0),
    workersPresent: integer("workers_present").notNull().default(0),
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
    buildingId: text("building_id"),
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
    // Carried so an entry written offline still names its block; the API
    // refuses a daily-log write without one on a multi-building project.
    buildingId: text("building_id"),
    logDate: text("log_date").notNull(),
    authorName: text("author_name").notNull().default(""),
    bodyText: text("body_text").notNull().default(""),
    bodyHtml: text("body_html"),
    voided: integer("voided", { mode: "boolean" }).notNull().default(false),
    // A form entry: the template it was filled against, its answers (JSON) and
    // any notes under the form. bodyHtml/bodyText hold the rendered whole, so the
    // day reads the same before and after sync.
    templateId: text("template_id"),
    responses: text("responses"),
    notesHtml: text("notes_html"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    isPendingSync: integer("is_pending_sync", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [index("daily_log_entries_day_idx").on(table.projectId, table.logDate)],
);

/**
 * The daily log forms an admin built on the web, cached per project so a crew
 * can fill one with no signal. Read-only here: each refresh replaces a
 * project's list, and the id is project-scoped because a workspace template
 * shows up in every project.
 */
export const dailyLogTemplates = sqliteTable(
  "daily_log_templates",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id").notNull(),
    projectId: text("project_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    scope: text("scope").notNull(),
    /** TemplateField[] as JSON. */
    fields: text("fields").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    position: integer("position").notNull().default(0),
  },
  (table) => [index("daily_log_templates_project_idx").on(table.projectId)],
);

export type DailyLogRow = typeof dailyLogs.$inferSelect;
export type DailyLogEntryRow = typeof dailyLogEntries.$inferSelect;
export type DailyLogActivityRow = typeof dailyLogActivities.$inferSelect;
export type DailyLogTemplateRow = typeof dailyLogTemplates.$inferSelect;
