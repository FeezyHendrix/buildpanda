import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * How this user uses each tool, and how they arranged Home. Lives only on the
 * phone, in the user's own database file; nothing is sent to the server.
 * `position` is set only once the user reorders Home by hand.
 */
export const homeToolUsage = sqliteTable("home_tool_usage", {
  key: text("key").primaryKey(),
  score: real("score").notNull().default(0),
  opens: integer("opens").notNull().default(0),
  lastUsedAt: integer("last_used_at").notNull().default(0),
  position: integer("position"),
  hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
});

export type HomeToolUsageRow = typeof homeToolUsage.$inferSelect;
