import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** The columns of a building's task board; a task's status is its column. */
export const taskColumns = sqliteTable(
  "task_columns",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    buildingId: text("building_id").notNull(),
    name: text("name").notNull(),
    status: text("status"),
    position: real("position").notNull().default(0),
  },
  (table) => [index("task_columns_board_idx").on(table.projectId, table.buildingId)],
);

/**
 * Tasks on a building's board. `assignees` is the server's list as JSON;
 * `assignedToMe` is worked out at pull time so "my tasks" is one indexed read.
 */
export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    buildingId: text("building_id").notNull(),
    columnId: text("column_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    descriptionHtml: text("description_html"),
    dueDate: text("due_date"),
    priority: text("priority").notNull().default("Medium"),
    assignees: text("assignees").notNull().default("[]"),
    assignedToMe: integer("assigned_to_me", { mode: "boolean" }).notNull().default(false),
    position: real("position").notNull().default(0),
    subtaskTotal: integer("subtask_total").notNull().default(0),
    subtaskDone: integer("subtask_done").notNull().default(0),
    createdByName: text("created_by_name"),
    isPendingSync: integer("is_pending_sync", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("tasks_board_idx").on(table.projectId, table.buildingId, table.columnId)],
);

export type TaskColumnRow = typeof taskColumns.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
