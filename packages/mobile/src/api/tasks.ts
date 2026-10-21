import { request } from "./client";

export type TaskPriority = "Low" | "Medium" | "High";
export const TASK_PRIORITIES: readonly TaskPriority[] = ["Low", "Medium", "High"];

export interface TaskAssignee {
  kind: "user" | "team";
  id: string;
  name: string;
}

export interface TaskColumn {
  id: string;
  name: string;
  /** Todo / Doing / Done for the standard columns; null for a custom one. */
  status: string | null;
  position: number;
}

export interface Task {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  descriptionHtml?: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  assignees: TaskAssignee[];
  position: number;
  subtaskTotal: number;
  subtaskDone: number;
  createdById: string | null;
  createdByName: string | null;
  /** Server-computed "created by or assigned to the caller", roster entries included. */
  mine?: boolean;
}

export interface TaskBoard {
  id: string;
  columns: TaskColumn[];
  tasks: Task[];
}

export interface AssignableUser {
  kind: "user" | "team";
  id: string;
  name: string;
  isSelf: boolean;
}

export interface CreateTaskInput {
  title: string;
  buildingId?: string | null;
  description?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  assignees?: { kind: "user" | "team"; id: string }[];
  columnId?: string | null;
}

export const tasksApi = {
  update: (projectId: string, taskId: string, body: Partial<Pick<CreateTaskInput, "title" | "description" | "dueDate" | "priority" | "assignees">>) =>
    request<Task>(`/projects/${projectId}/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (projectId: string, taskId: string) => request<void>(`/projects/${projectId}/tasks/${taskId}`, { method: "DELETE" }),
  comment: (projectId: string, taskId: string, body: string) =>
    request<unknown>(`/projects/${projectId}/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
  /** Without `full`, return tasks created by or assigned to the caller. */
  board: (projectId: string, buildingId: string, full: boolean) => {
    const query = new URLSearchParams({ buildingId, scope: full ? "all" : "assigned" });
    return request<TaskBoard>(`/projects/${projectId}/tasks/board?${query.toString()}`);
  },

  assignable: (projectId: string) => request<AssignableUser[]>(`/projects/${projectId}/tasks/assignable`),

  create: (projectId: string, body: CreateTaskInput) =>
    request<Task>(`/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(body) }),

  move: (projectId: string, taskId: string, columnId: string, position: number) =>
    request<Task>(`/projects/${projectId}/tasks/${taskId}/move`, {
      method: "PATCH",
      body: JSON.stringify({ columnId, position }),
    }),
};
