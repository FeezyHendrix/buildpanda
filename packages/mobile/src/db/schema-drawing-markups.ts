import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Plan-review tables, split from schema.ts to keep that file under the size
// ceiling. drizzle-kit reads them through the re-export in schema.ts.

// A markup drawn on site must survive no signal like every other record here:
// it is written locally and queued, never posted straight to the network.
// Geometry is the same jsonb shape the server stores, kept as text.
export const drawingMarkups = sqliteTable(
  "drawing_markups",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    documentId: text("document_id").notNull(),
    documentVersionId: text("document_version_id").notNull(),
    pageNo: integer("page_no").notNull().default(1),
    kind: text("kind").notNull(),
    /** JSON: the MarkupGeometry the canvas produced, including its space. */
    geometry: text("geometry").notNull(),
    color: text("color").notNull().default("#004DE7"),
    resolvedAt: text("resolved_at"),
    isPendingSync: integer("is_pending_sync", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("drawing_markups_sheet_idx").on(table.documentVersionId, table.pageNo)],
);
// The first comment on a pin, and any reply, written on site. Media is staged
// on disk and its path kept here, so the upload can happen when signal returns
// rather than being required at the moment the crew member speaks.
export const drawingMarkupComments = sqliteTable(
  "drawing_markup_comments",
  {
    id: text("id").primaryKey(),
    markupId: text("markup_id").notNull(),
    projectId: text("project_id").notNull(),
    body: text("body").notNull().default(""),
    mediaKind: text("media_kind"),
    /** A durable local path to media that has not been uploaded yet. */
    stagedMediaUri: text("staged_media_uri"),
    mediaDurationSeconds: integer("media_duration_seconds"),
    assigneeId: text("assignee_id"),
    authorName: text("author_name").notNull().default(""),
    isPendingSync: integer("is_pending_sync", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("drawing_markup_comments_markup_idx").on(table.markupId, table.createdAt)],
);

export type DrawingMarkupRow = typeof drawingMarkups.$inferSelect;
export type DrawingMarkupCommentRow = typeof drawingMarkupComments.$inferSelect;
