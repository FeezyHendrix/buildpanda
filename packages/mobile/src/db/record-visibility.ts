import { and, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { projectAccess } from "@/lib/project-access-store";
import { tasks, expenses } from "./schema";

interface AuthoredRecord {
  id: AnySQLiteColumn;
  createdById: AnySQLiteColumn;
  isPendingSync: AnySQLiteColumn;
}

function authoredByCurrentUser(table: AuthoredRecord): SQL {
  const userId = projectAccess.getState().scope?.userId;
  if (!userId) return sql`0 = 1`;
  return or(eq(table.createdById, userId), and(
    // Pre-migration drafts are authored in this user's isolated database. Never
    // infer authorship for server rows or pending edits to somebody else's row.
    isNull(table.createdById), eq(table.isPendingSync, true), sql`substr(${table.id}, 1, 6) = 'local_'`,
  ))!;
}

function hasFullVisibility(resource: string, action: string): boolean {
  const projectId = projectAccess.getState().scope?.projectId;
  return !!projectId && projectAccess.can(projectId, resource, action);
}

/** Apply alongside repositoryAccess.where, which verifies identity and scope. */
export const taskReadWhere = (): SQL | undefined => hasFullVisibility("tasks", "viewAll")
  ? undefined : or(authoredByCurrentUser(tasks), eq(tasks.assignedToMe, true));

export const expenseReadWhere = (): SQL | undefined => hasFullVisibility("finances", "viewAllExpenses")
  ? undefined : authoredByCurrentUser(expenses);

export function isMyTask(task: { id: string; createdById: string | null; assignedToMe: boolean; isPendingSync: boolean }, userId: string | undefined): boolean {
  return !!userId && (task.assignedToMe || task.createdById === userId ||
    (!task.createdById && task.isPendingSync && task.id.startsWith("local_")));
}
