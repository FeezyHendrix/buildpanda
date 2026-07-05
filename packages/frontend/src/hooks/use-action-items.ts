import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actionItemKeys } from "./query-keys";
import { actionItemsApi, type ActionItemInput } from "@/api/action-items";
import type { ActionStatus } from "@/lib/project-types";

export function useActionItems(projectId: string | undefined, status?: ActionStatus) {
  return useQuery({
    queryKey: actionItemKeys.list(projectId ?? "__none__", status),
    queryFn: () => actionItemsApi.list(projectId!, status ? { status } : undefined),
    enabled: Boolean(projectId),
  });
}

export function useActionItem(projectId: string | undefined, itemId: string | undefined) {
  return useQuery({
    queryKey: actionItemKeys.detail(projectId ?? "__none__", itemId ?? "__none__"),
    queryFn: () => actionItemsApi.detail(projectId!, itemId!),
    enabled: Boolean(projectId && itemId),
  });
}

export function useCreateActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...body }: ActionItemInput & { projectId: string }) => actionItemsApi.create(projectId, body),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: actionItemKeys.all(projectId) }),
  });
}

export function useUpdateActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, itemId, ...body }: Partial<ActionItemInput> & { projectId: string; itemId: string }) => actionItemsApi.update(projectId, itemId, body),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: actionItemKeys.all(projectId) }),
  });
}

export function useDeleteActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, itemId }: { projectId: string; itemId: string }) => actionItemsApi.delete(projectId, itemId),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: actionItemKeys.all(projectId) }),
  });
}

export function useAddActionComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, itemId, body }: { projectId: string; itemId: string; body: string }) => actionItemsApi.addComment(projectId, itemId, body),
    onSuccess: (_d, { projectId, itemId }) => {
      qc.invalidateQueries({ queryKey: actionItemKeys.detail(projectId, itemId) });
      qc.invalidateQueries({ queryKey: actionItemKeys.all(projectId) });
    },
  });
}
