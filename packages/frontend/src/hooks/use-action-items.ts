import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { actionItemKeys } from "./query-keys";
import type {
  ActionComment,
  ActionItem,
  ActionItemDetail,
  ActionPriority,
  ActionStatus,
  RecurrenceUnit,
} from "@/lib/project-types";

export function useActionItems(projectId: string | undefined, status?: ActionStatus) {
  return useQuery({
    queryKey: actionItemKeys.list(projectId ?? "__none__", status),
    queryFn: async () => {
      const { data } = await api.get<ActionItem[]>(`/projects/${projectId!}/action-items`, {
        params: status ? { status } : undefined,
      });
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useActionItem(projectId: string | undefined, itemId: string | undefined) {
  return useQuery({
    queryKey: actionItemKeys.detail(projectId ?? "__none__", itemId ?? "__none__"),
    queryFn: async () => {
      const { data } = await api.get<ActionItemDetail>(
        `/projects/${projectId!}/action-items/${itemId!}`,
      );
      return data;
    },
    enabled: Boolean(projectId && itemId),
  });
}

export interface ActionItemInput {
  title: string;
  description?: string | null;
  status?: ActionStatus;
  priority?: ActionPriority;
  dueDate?: string | null;
  recurrenceUnit?: RecurrenceUnit | null;
  recurrenceInterval?: number | null;
  recurrenceUntil?: string | null;
}

export function useCreateActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...body }: ActionItemInput & { projectId: string }) => {
      const { data } = await api.post<ActionItem>(`/projects/${projectId}/action-items`, body);
      return data;
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: actionItemKeys.all(projectId) }),
  });
}

export function useUpdateActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      itemId,
      ...body
    }: Partial<ActionItemInput> & { projectId: string; itemId: string }) => {
      const { data } = await api.patch<ActionItem>(
        `/projects/${projectId}/action-items/${itemId}`,
        body,
      );
      return data;
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: actionItemKeys.all(projectId) }),
  });
}

export function useDeleteActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, itemId }: { projectId: string; itemId: string }) => {
      await api.delete(`/projects/${projectId}/action-items/${itemId}`);
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: actionItemKeys.all(projectId) }),
  });
}

export function useAddActionComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      itemId,
      body,
    }: {
      projectId: string;
      itemId: string;
      body: string;
    }) => {
      const { data } = await api.post<ActionComment>(
        `/projects/${projectId}/action-items/${itemId}/comments`,
        { body },
      );
      return data;
    },
    onSuccess: (_d, { projectId, itemId }) => {
      qc.invalidateQueries({ queryKey: actionItemKeys.detail(projectId, itemId) });
      qc.invalidateQueries({ queryKey: actionItemKeys.all(projectId) });
    },
  });
}
