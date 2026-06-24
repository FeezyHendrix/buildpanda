import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { taskKeys } from "./query-keys";
import type { Subtask, Task, TaskBoard, TaskColumn, TaskDetail, TaskLink, TaskLinkType, TaskPriority, AssignableUser } from "@/lib/project-types";

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  descriptionHtml?: string | null;
  assigneeId?: string | null;
  assigneeTeamMemberId?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  columnId?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  descriptionHtml?: string | null;
  assigneeId?: string | null;
  assigneeTeamMemberId?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
}

export function useTaskBoard(projectId: string) {
  return useQuery({
    queryKey: taskKeys.board(projectId),
    queryFn: async () => {
      const { data } = await api.get<TaskBoard>(`/projects/${projectId}/tasks/board`);
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useAssignableUsers(projectId: string) {
  return useQuery({
    queryKey: taskKeys.assignable(projectId),
    queryFn: async () => {
      const { data } = await api.get<AssignableUser[]>(`/projects/${projectId}/tasks/assignable`);
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useCreateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const { data } = await api.post<Task>(`/projects/${projectId}/tasks`, input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.board(projectId) }),
  });
}

export function useUpdateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, input }: { taskId: string; input: UpdateTaskInput }) => {
      const { data } = await api.patch<Task>(`/projects/${projectId}/tasks/${taskId}`, input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.board(projectId) }),
  });
}

export function useMoveTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      columnId,
      position,
    }: {
      taskId: string;
      columnId: string;
      position: number;
    }) => {
      const { data } = await api.patch<Task>(`/projects/${projectId}/tasks/${taskId}/move`, {
        columnId,
        position,
      });
      return data;
    },
    onMutate: async ({ taskId, columnId, position }) => {
      await qc.cancelQueries({ queryKey: taskKeys.board(projectId) });
      const previous = qc.getQueryData<TaskBoard>(taskKeys.board(projectId));
      if (previous) {
        qc.setQueryData<TaskBoard>(taskKeys.board(projectId), {
          ...previous,
          tasks: previous.tasks.map((t) =>
            t.id === taskId ? { ...t, columnId, position } : t,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(taskKeys.board(projectId), context.previous);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.board(projectId) }),
  });
}

export function useDeleteTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      await api.delete(`/projects/${projectId}/tasks/${taskId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.board(projectId) }),
  });
}

export function useAddColumn(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post<TaskColumn>(`/projects/${projectId}/tasks/columns`, { name });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.board(projectId) }),
  });
}

export function useRenameColumn(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ columnId, name }: { columnId: string; name: string }) => {
      const { data } = await api.patch<TaskColumn>(
        `/projects/${projectId}/tasks/columns/${columnId}`,
        { name },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.board(projectId) }),
  });
}

export function useDeleteColumn(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (columnId: string) => {
      await api.delete(`/projects/${projectId}/tasks/columns/${columnId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.board(projectId) }),
  });
}

export function useReorderColumns(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (columnIds: string[]) => {
      const { data } = await api.patch<TaskColumn[]>(
        `/projects/${projectId}/tasks/columns/reorder`,
        { columnIds },
      );
      return data;
    },
    onMutate: async (columnIds: string[]) => {
      await qc.cancelQueries({ queryKey: taskKeys.board(projectId) });
      const previous = qc.getQueryData<TaskBoard>(taskKeys.board(projectId));
      if (previous) {
        const byId = new Map(previous.columns.map((c) => [c.id, c]));
        const reordered = columnIds
          .map((id, index) => {
            const column = byId.get(id);
            return column ? { ...column, position: index } : null;
          })
          .filter((c): c is TaskColumn => c !== null);
        qc.setQueryData<TaskBoard>(taskKeys.board(projectId), {
          ...previous,
          columns: reordered,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(taskKeys.board(projectId), context.previous);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.board(projectId) }),
  });
}

export function useTaskDetail(projectId: string, taskId: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(projectId, taskId ?? "__none__"),
    queryFn: async () => {
      const { data } = await api.get<TaskDetail>(`/projects/${projectId}/tasks/${taskId}`);
      return data;
    },
    enabled: Boolean(projectId && taskId),
  });
}

function useTaskChildMutation<TVars>(projectId: string, taskId: string, fn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(projectId, taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.board(projectId) });
    },
  });
}

export function useAddSubtask(projectId: string, taskId: string) {
  return useTaskChildMutation<string>(projectId, taskId, (title) =>
    api.post<Subtask>(`/projects/${projectId}/tasks/${taskId}/subtasks`, { title }).then((r) => r.data),
  );
}

export function useUpdateSubtask(projectId: string, taskId: string) {
  return useTaskChildMutation<{ subtaskId: string; title?: string; done?: boolean }>(
    projectId,
    taskId,
    ({ subtaskId, ...patch }) =>
      api.patch<Subtask>(`/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`, patch).then((r) => r.data),
  );
}

export function useDeleteSubtask(projectId: string, taskId: string) {
  return useTaskChildMutation<string>(projectId, taskId, (subtaskId) =>
    api.delete(`/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`),
  );
}

export function useAddLink(projectId: string, taskId: string) {
  return useTaskChildMutation<{ targetTaskId: string; linkType: TaskLinkType }>(
    projectId,
    taskId,
    (body) => api.post<TaskLink>(`/projects/${projectId}/tasks/${taskId}/links`, body).then((r) => r.data),
  );
}

export function useDeleteLink(projectId: string, taskId: string) {
  return useTaskChildMutation<string>(projectId, taskId, (linkId) =>
    api.delete(`/projects/${projectId}/tasks/${taskId}/links/${linkId}`),
  );
}
