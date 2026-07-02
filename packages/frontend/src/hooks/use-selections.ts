import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { changeRequestKeys, selectionKeys } from "./query-keys";
import type { Selection, SelectionStatus } from "@/lib/project-types";

export function useSelections(projectId: string | undefined, status?: SelectionStatus) {
  return useQuery({
    queryKey: selectionKeys.list(projectId ?? "__none__", status),
    queryFn: async () => {
      const { data } = await api.get<Selection[]>(`/projects/${projectId!}/selections`, {
        params: status ? { status } : undefined,
      });
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export interface SelectionOptionInput {
  name: string;
  description?: string | null;
  price?: number | null;
}

export interface SelectionCreateInput {
  title: string;
  description?: string | null;
  category?: string | null;
  allowanceAmount?: number | null;
  dueDate?: string | null;
  options?: SelectionOptionInput[];
}

export interface SelectionUpdateInput {
  title?: string;
  description?: string | null;
  category?: string | null;
  allowanceAmount?: number | null;
  dueDate?: string | null;
  status?: "open" | "cancelled";
  options?: SelectionOptionInput[];
}

export function useCreateSelection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...body }: SelectionCreateInput & { projectId: string }) => {
      const { data } = await api.post<Selection>(`/projects/${projectId}/selections`, body);
      return data;
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: selectionKeys.all(projectId) }),
  });
}

export function useUpdateSelection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      selectionId,
      ...body
    }: SelectionUpdateInput & { projectId: string; selectionId: string }) => {
      const { data } = await api.patch<Selection>(
        `/projects/${projectId}/selections/${selectionId}`,
        body,
      );
      return data;
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: selectionKeys.all(projectId) }),
  });
}

export function useDeleteSelection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, selectionId }: { projectId: string; selectionId: string }) => {
      await api.delete(`/projects/${projectId}/selections/${selectionId}`);
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: selectionKeys.all(projectId) }),
  });
}

export function useDecideSelection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      selectionId,
      optionId,
    }: {
      projectId: string;
      selectionId: string;
      optionId: string;
    }) => {
      const { data } = await api.post<Selection>(
        `/projects/${projectId}/selections/${selectionId}/decide`,
        { optionId },
      );
      return data;
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: selectionKeys.all(projectId) }),
  });
}

export function useCreateSelectionChangeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, selectionId }: { projectId: string; selectionId: string }) => {
      const { data } = await api.post<Selection>(
        `/projects/${projectId}/selections/${selectionId}/create-change-request`,
      );
      return data;
    },
    onSuccess: (_d, { projectId }) => {
      qc.invalidateQueries({ queryKey: selectionKeys.all(projectId) });
      qc.invalidateQueries({ queryKey: changeRequestKeys.all(projectId) });
    },
  });
}
