export type TaskStatus = "Todo" | "Doing" | "Done";

export const TASK_PRIORITIES = ["Low", "Medium", "High"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

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
  "action_item",
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

export interface TaskEntityLinkRow {
  id: string;
  project_id: string;
  task_id: string;
  entity_type: TaskEntityType;
  entity_id: string;
  created_at: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface TaskCommentRow {
  id: string;
  task_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
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
  scope: "all" | "assigned";
  columns: TaskColumn[];
  tasks: Task[];
}

export interface TaskColumnRow {
  id: string;
  board_id: string;
  name: string;
  status: string | null;
  position: number;
}

export interface TaskRow {
  id: string;
  project_id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string | null;
  description_html: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  assignee_team_member_id: string | null;
  assignee_team_member_name: string | null;
  due_date: string | null;
  priority: TaskPriority;
  labels: string[] | string;
  position: number;
  source_type: string | null;
  source_id: string | null;
  created_by_id: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskBoardRow {
  id: string;
  project_id: string;
  name: string;
  is_default: boolean;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubtaskRow {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  position: number;
  created_at: string;
}

export interface TaskLinkRow {
  id: string;
  project_id: string;
  source_task_id: string;
  target_task_id: string;
  target_task_title: string;
  link_type: TaskLinkType;
  created_at: string;
}
