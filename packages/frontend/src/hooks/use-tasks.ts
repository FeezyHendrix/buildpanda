import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { taskKeys } from "./query-keys";
import type { TaskBoard, TaskColumn } from "@/lib/project-types";
import {
  taskApi,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "@/api/tasks";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import type { TaskLinkType, TaskEntityType } from "@/lib/project-types";

export function useTaskBoard(projectId: string, scope: "all" | "assigned" = "all", enabled = true) {
  return useQuery({
    queryKey: taskKeys.board(projectId, scope),
    queryFn: () => taskApi.board(projectId, scope),
    enabled: Boolean(projectId) && enabled,
  });
}

export function useAssignableUsers(projectId: string) {
  return useQuery({
    queryKey: taskKeys.assignable(projectId),
    queryFn: () => taskApi.assignableUsers(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => taskApi.create(projectId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all(projectId) }),
  });
}

export function useUpdateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateTaskInput }) =>
      taskApi.update(projectId, taskId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all(projectId) }),
  });
}

export function useMoveTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      columnId,
      position,
    }: {
      taskId: string;
      columnId: string;
      position: number;
    }) => taskApi.move(projectId, taskId, columnId, position),
    onMutate: async ({ taskId, columnId, position }) => {
      await qc.cancelQueries({ queryKey: taskKeys.all(projectId) });
      const previousQueries = qc.getQueriesData<TaskBoard>({ queryKey: taskKeys.all(projectId) });
      if (previousQueries.length > 0) {
        for (const [key, board] of previousQueries) {
          if (!board) continue;
          qc.setQueryData<TaskBoard>(key, {
            ...board,
            tasks: board.tasks.map((t) =>
              t.id === taskId ? { ...t, columnId, position } : t,
            ),
          });
        }
      }
      return { previousQueries };
    },
    onError: (err, _vars, context) => {
      if (context?.previousQueries) {
        for (const [key, board] of context.previousQueries) {
          qc.setQueryData(key, board);
        }
      }
      toast(getApiErrorMessage(err, "Couldn't move that task."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all(projectId) }),
  });
}

export function useDeleteTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => taskApi.delete(projectId, taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all(projectId) }),
  });
}

export function useAddColumn(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => taskApi.addColumn(projectId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all(projectId) }),
  });
}

export function useRenameColumn(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ columnId, name }: { columnId: string; name: string }) =>
      taskApi.renameColumn(projectId, columnId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all(projectId) }),
  });
}

export function useDeleteColumn(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (columnId: string) => taskApi.deleteColumn(projectId, columnId),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all(projectId) }),
  });
}

export function useReorderColumns(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (columnIds: string[]) => taskApi.reorderColumns(projectId, columnIds),
    onMutate: async (columnIds: string[]) => {
      await qc.cancelQueries({ queryKey: taskKeys.board(projectId, "all") });
      const previous = qc.getQueryData<TaskBoard>(taskKeys.board(projectId, "all"));
      if (previous) {
        const byId = new Map(previous.columns.map((c) => [c.id, c]));
        const reordered = columnIds
          .map((id, index) => {
            const column = byId.get(id);
            return column ? { ...column, position: index } : null;
          })
          .filter((c): c is TaskColumn => c !== null);
        qc.setQueryData<TaskBoard>(taskKeys.board(projectId, "all"), {
          ...previous,
          columns: reordered,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(taskKeys.board(projectId, "all"), context.previous);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all(projectId) }),
  });
}

export function useTaskDetail(projectId: string, taskId: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(projectId, taskId ?? "__none__"),
    queryFn: () => taskApi.detail(projectId, taskId!),
    enabled: Boolean(projectId && taskId),
  });
}

function useTaskChildMutation<TVars>(projectId: string, taskId: string, fn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(projectId, taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all(projectId) });
    },
  });
}

export function useAddSubtask(projectId: string, taskId: string) {
  return useTaskChildMutation<string>(projectId, taskId, (title) =>
    taskApi.addSubtask(projectId, taskId, title),
  );
}

export function useUpdateSubtask(projectId: string, taskId: string) {
  return useTaskChildMutation<{ subtaskId: string; title?: string; done?: boolean }>(
    projectId,
    taskId,
    ({ subtaskId, ...patch }) =>
      taskApi.updateSubtask(projectId, taskId, subtaskId, patch),
  );
}

export function useDeleteSubtask(projectId: string, taskId: string) {
  return useTaskChildMutation<string>(projectId, taskId, (subtaskId) =>
    taskApi.deleteSubtask(projectId, taskId, subtaskId),
  );
}

export function useAddLink(projectId: string, taskId: string) {
  return useTaskChildMutation<{ targetTaskId: string; linkType: TaskLinkType }>(
    projectId,
    taskId,
    (body) => taskApi.addLink(projectId, taskId, body),
  );
}

export function useDeleteLink(projectId: string, taskId: string) {
  return useTaskChildMutation<string>(projectId, taskId, (linkId) =>
    taskApi.deleteLink(projectId, taskId, linkId),
  );
}

export function useAddEntityLink(projectId: string, taskId: string) {
  return useTaskChildMutation<{ entityType: TaskEntityType; entityId: string }>(
    projectId,
    taskId,
    (body) => taskApi.addEntityLink(projectId, taskId, body),
  );
}

export function useDeleteEntityLink(projectId: string, taskId: string) {
  return useTaskChildMutation<string>(projectId, taskId, (linkId) =>
    taskApi.deleteEntityLink(projectId, taskId, linkId),
  );
}

export function useAddTaskComment(projectId: string, taskId: string) {
  return useTaskChildMutation<string>(projectId, taskId, (body) =>
    taskApi.addComment(projectId, taskId, body),
  );
}
