import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Project update tables, split from schema.ts to keep that file under the size
// ceiling. drizzle-kit reads them through the re-export in schema.ts.

/**
 * A posted project update, local-first.
 *
 * An update written in a basement is a real site record — a delivery note, an
 * inspection, an issue — so it lands here with `isPendingSync` and is pushed by
 * the outbox. A pull never overwrites a row whose push is still queued.
 */
export const projectUpdates = sqliteTable(
  "project_updates",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    descriptionHtml: text("description_html"),
    authorName: text("author_name"),
    authorRole: text("author_role"),
    status: text("status"),
    /** ISO timestamp, so the feed orders the same way the server's does. */
    createdAt: text("created_at").notNull(),
    isPendingSync: integer("is_pending_sync", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("project_updates_project_idx").on(table.projectId, table.createdAt)],
);

/**
 * One photo or video attached to an update.
 *
 * A child table rather than a JSON column, so each file uploads and retries on
 * its own: a crew member who attached six photos in a basement must not re-send
 * the five that already landed because the sixth failed. `stagedUri` is the
 * durable local copy of the bytes; `url` is the server's, known only once that
 * file has been uploaded.
 */
export const projectUpdateMedia = sqliteTable(
  "project_update_media",
  {
    id: text("id").primaryKey(),
    updateId: text("update_id").notNull(),
    /** "photo" | "video" — the backend's MediaType. */
    type: text("type").notNull(),
    stagedUri: text("staged_uri"),
    url: text("url"),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type"),
    position: integer("position").notNull().default(0),
  },
  (table) => [index("project_update_media_update_idx").on(table.updateId, table.position)],
);

export type ProjectUpdateRow = typeof projectUpdates.$inferSelect;
export type ProjectUpdateMediaRow = typeof projectUpdateMedia.$inferSelect;
