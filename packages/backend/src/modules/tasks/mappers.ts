import type {
  Subtask,
  SubtaskRow,
  Task,
  TaskAssignee,
  TaskAssigneeRow,
  TaskColumn,
  TaskColumnRow,
  TaskComment,
  TaskCommentRow,
  TaskEntityType,
  TaskLink,
  TaskLinkRow,
  TaskRow,
} from "./types.ts";

export function toColumn(row: TaskColumnRow): TaskColumn {
  return {
    id: row.id,
    boardId: row.board_id,
    name: row.name,
    status: row.status,
    position: row.position,
  };
}

function parseLabels(value: string[] | string): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizeLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const label = raw.trim().slice(0, 40);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= 20) break;
  }
  return out;
}

export function toTask(
  row: TaskRow,
  assignees: TaskAssignee[] = [],
  counts?: { total: number; done: number },
  entityLinkTypes?: TaskEntityType[],
): Task {
  const firstAssignee = assignees[0] ?? null;
  return {
    id: row.id,
    projectId: row.project_id,
    boardId: row.board_id,
    columnId: row.column_id,
    title: row.title,
    description: row.description,
    descriptionHtml: row.description_html,
    assigneeId: row.assignee_id,
    assigneeTeamMemberId: row.assignee_team_member_id,
    assigneeName: firstAssignee?.name ?? null,
    assignees,
    dueDate: row.due_date,
    priority: row.priority,
    labels: parseLabels(row.labels),
    position: row.position,
    sourceType: row.source_type,
    sourceId: row.source_id,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    subtaskTotal: counts?.total ?? 0,
    subtaskDone: counts?.done ?? 0,
    entityLinkTypes: entityLinkTypes ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function groupAssignees(rows: TaskAssigneeRow[]): Map<string, TaskAssignee[]> {
  const grouped = new Map<string, TaskAssignee[]>();
  for (const row of rows) {
    const assignee = row.assignee_id
      ? { kind: "user" as const, id: row.assignee_id, name: row.assignee_name ?? "Unknown user" }
      : row.assignee_team_member_id
        ? { kind: "team" as const, id: row.assignee_team_member_id, name: row.assignee_team_member_name ?? "Unknown team member" }
        : null;
    if (!assignee) continue;
    const list = grouped.get(row.task_id) ?? [];
    list.push(assignee);
    grouped.set(row.task_id, list);
  }
  return grouped;
}

export function toSubtask(row: SubtaskRow): Subtask {
  return { id: row.id, taskId: row.task_id, title: row.title, done: row.done, position: row.position };
}

export function toLink(row: TaskLinkRow): TaskLink {
  return {
    id: row.id,
    linkType: row.link_type,
    targetTaskId: row.target_task_id,
    targetTaskTitle: row.target_task_title,
  };
}

export function toComment(row: TaskCommentRow): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

