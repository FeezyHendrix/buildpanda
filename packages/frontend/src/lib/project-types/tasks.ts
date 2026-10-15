

export type TaskStatus = "Todo" | "Doing" | "Done";

export interface TaskColumn {
  id: string;
  boardId: string;
  name: string;
  status: string | null;
  position: number;
}

export interface Task {
  id: string;
  projectId: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string | null;
  descriptionHtml: string | null;
  assigneeId: string | null;
  assigneeTeamMemberId: string | null;
  assigneeName: string | null;
  assignees: TaskAssignee[];
  dueDate: string | null;
  priority: TaskPriority;
  labels: string[];
  position: number;
  sourceType: string | null;
  sourceId: string | null;
  createdById: string | null;
  createdByName: string | null;
  subtaskTotal: number;
  subtaskDone: number;
  entityLinkTypes: TaskEntityType[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskAssignee {
  kind: "user" | "team";
  id: string;
  name: string;
}

export type TaskPriority = "Low" | "Medium" | "High";

export interface AssignableUser {
  kind: "user" | "team";
  id: string;
  name: string;
  email: string | null;
  isSelf: boolean;
}

export type TaskLinkType = "relates_to" | "blocks" | "blocked_by" | "duplicates";

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  position: number;
}

export interface TaskLink {
  id: string;
  linkType: TaskLinkType;
  targetTaskId: string;
  targetTaskTitle: string;
}

export const TASK_ENTITY_TYPES = [
  "rfi",
  "change_request",
  "material",
  "invoice",
  "milestone_payment",
] as const;
export type TaskEntityType = (typeof TASK_ENTITY_TYPES)[number];

export interface TaskEntityLink {
  id: string;
  entityType: TaskEntityType;
  entityId: string;
  label: string;
  status: string | null;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface TaskDetail extends Task {
  subtasks: Subtask[];
  links: TaskLink[];
  entityLinks: TaskEntityLink[];
  comments: TaskComment[];
}

export interface TaskBoard {
  id: string;
  projectId: string;
  name: string;
  isDefault: boolean;
  scope: "all" | "assigned" | "mine";
  columns: TaskColumn[];
  tasks: Task[];
}
