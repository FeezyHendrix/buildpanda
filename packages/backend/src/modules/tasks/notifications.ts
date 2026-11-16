import type { TasksDeps, TaskRow, TaskAssignee } from "./types.ts";
export function notifyAssignees(
  deps: TasksDeps,
  row: TaskRow,
  assignees: TaskAssignee[],
  actorId: string | null,
): void {
  if (!deps.notifications) return;
  for (const assignee of assignees) {
    if (assignee.kind !== "user" || assignee.id === actorId) continue;
    void deps.notifications
      .notify(assignee.id, "task_assigned", {
        title: "A task was assigned to you",
        body: row.title,
        projectId: row.project_id,
        ctaUrl: `/project/${row.project_id}/tasks?task=${row.id}`,
      })
      .catch(() => undefined);
  }
}

export function notifyHighPriority(
  deps: TasksDeps,
  row: TaskRow,
  assignees: TaskAssignee[],
  actorId: string | null,
): void {
  if (!deps.notifications || row.priority !== "High") return;
  for (const assignee of assignees) {
    if (assignee.kind !== "user" || assignee.id === actorId) continue;
    void deps.notifications
      .notify(assignee.id, "task_high_priority", {
        title: "A high-priority task needs your attention",
        body: row.title,
        projectId: row.project_id,
        ctaUrl: `/project/${row.project_id}/tasks?task=${row.id}`,
      })
      .catch(() => undefined);
  }
}

