import api from "./client";
import type {
  Subtask,
  Task,
  TaskBoard,
  TaskColumn,
  TaskDetail,
  TaskLink,
  TaskLinkType,
  TaskPriority,
  AssignableUser,
  TaskEntityLink,
  TaskEntityType,
  TaskComment,
  TaskAssignee,
} from "@/lib/project-types";

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  descriptionHtml?: string | null;
  assigneeId?: string | null;
  assigneeTeamMemberId?: string | null;
  assignees?: Pick<TaskAssignee, "kind" | "id">[];
  dueDate?: string | null;
  priority?: TaskPriority;
  labels?: string[];
  columnId?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  descriptionHtml?: string | null;
  assigneeId?: string | null;
  assigneeTeamMemberId?: string | null;
  assignees?: Pick<TaskAssignee, "kind" | "id">[];
  dueDate?: string | null;
  priority?: TaskPriority;
  labels?: string[];
}

export const taskApi = {
  board: (projectId: string, scope?: "all" | "assigned") =>
    api.get<TaskBoard>(`/projects/${projectId}/tasks/board`, { params: scope ? { scope } : undefined }).then((r) => r.data),

  assignableUsers: (projectId: string) =>
    api.get<AssignableUser[]>(`/projects/${projectId}/tasks/assignable`).then((r) => r.data),

  create: (projectId: string, input: CreateTaskInput) =>
    api.post<Task>(`/projects/${projectId}/tasks`, input).then((r) => r.data),

  update: (projectId: string, taskId: string, input: UpdateTaskInput) =>
    api.patch<Task>(`/projects/${projectId}/tasks/${taskId}`, input).then((r) => r.data),

  move: (projectId: string, taskId: string, columnId: string, position: number) =>
    api.patch<Task>(`/projects/${projectId}/tasks/${taskId}/move`, { columnId, position }).then((r) => r.data),

  delete: (projectId: string, taskId: string) =>
    api.delete(`/projects/${projectId}/tasks/${taskId}`).then((r) => r.data),

  addColumn: (projectId: string, name: string) =>
    api.post<TaskColumn>(`/projects/${projectId}/tasks/columns`, { name }).then((r) => r.data),

  renameColumn: (projectId: string, columnId: string, name: string) =>
    api.patch<TaskColumn>(`/projects/${projectId}/tasks/columns/${columnId}`, { name }).then((r) => r.data),

  deleteColumn: (projectId: string, columnId: string) =>
    api.delete(`/projects/${projectId}/tasks/columns/${columnId}`).then((r) => r.data),

  reorderColumns: (projectId: string, columnIds: string[]) =>
    api.patch<TaskColumn[]>(`/projects/${projectId}/tasks/columns/reorder`, { columnIds }).then((r) => r.data),

  detail: (projectId: string, taskId: string) =>
    api.get<TaskDetail>(`/projects/${projectId}/tasks/${taskId}`).then((r) => r.data),

  addSubtask: (projectId: string, taskId: string, title: string) =>
    api.post<Subtask>(`/projects/${projectId}/tasks/${taskId}/subtasks`, { title }).then((r) => r.data),

  updateSubtask: (projectId: string, taskId: string, subtaskId: string, patch: { title?: string; done?: boolean }) =>
    api.patch<Subtask>(`/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`, patch).then((r) => r.data),

  deleteSubtask: (projectId: string, taskId: string, subtaskId: string) =>
    api.delete(`/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`).then((r) => r.data),

  addLink: (projectId: string, taskId: string, body: { targetTaskId: string; linkType: TaskLinkType }) =>
    api.post<TaskLink>(`/projects/${projectId}/tasks/${taskId}/links`, body).then((r) => r.data),

  deleteLink: (projectId: string, taskId: string, linkId: string) =>
    api.delete(`/projects/${projectId}/tasks/${taskId}/links/${linkId}`).then((r) => r.data),

  addEntityLink: (projectId: string, taskId: string, body: { entityType: TaskEntityType; entityId: string }) =>
    api.post<TaskEntityLink>(`/projects/${projectId}/tasks/${taskId}/entity-links`, body).then((r) => r.data),

  deleteEntityLink: (projectId: string, taskId: string, linkId: string) =>
    api.delete(`/projects/${projectId}/tasks/${taskId}/entity-links/${linkId}`).then((r) => r.data),

  addComment: (projectId: string, taskId: string, body: string) =>
    api.post<TaskComment>(`/projects/${projectId}/tasks/${taskId}/comments`, { body }).then((r) => r.data),
};
