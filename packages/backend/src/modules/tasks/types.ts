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
  position: number;
  sourceType: string | null;
  sourceId: string | null;
  createdById: string | null;
  createdByName: string | null;
  subtaskTotal: number;
  subtaskDone: number;
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

export interface TaskDetail extends Task {
  subtasks: Subtask[];
  links: TaskLink[];
}

export interface TaskBoard {
  id: string;
  projectId: string;
  name: string;
  isDefault: boolean;
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
