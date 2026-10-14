import type { Task, TaskColumn } from "@/lib/project-types";

// Completion is a column move, not a field on the task: the backend counts a
// task overdue only while its column's status is not "Done"
// (modules/reporting/service.ts). Changing this string decouples the board
// from that count.
const DONE_STATUS = "Done";

export function isDoneColumn(column: Pick<TaskColumn, "status">): boolean {
  return column.status === DONE_STATUS;
}

export function findDoneColumn(columns: readonly TaskColumn[]): TaskColumn | null {
  return columns.find(isDoneColumn) ?? null;
}

/** Where a completed task returns to when it is reopened. */
export function findReopenColumn(columns: readonly TaskColumn[]): TaskColumn | null {
  return columns.find((column) => !isDoneColumn(column)) ?? null;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isTaskOverdue(
  task: Pick<Task, "dueDate">,
  done: boolean,
  today = todayIso(),
): boolean {
  if (done || !task.dueDate) return false;
  return task.dueDate.slice(0, 10) < today;
}

export function taskOverdueDays(task: Pick<Task, "dueDate">, today = todayIso()): number {
  if (!task.dueDate) return 0;
  const due = new Date(`${task.dueDate.slice(0, 10)}T00:00:00`).getTime();
  const now = new Date(`${today}T00:00:00`).getTime();
  return Math.max(0, Math.round((now - due) / 86_400_000));
}
