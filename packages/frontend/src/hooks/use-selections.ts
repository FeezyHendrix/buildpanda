import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  selectionsApi,
  type SelectionOptionInput,
  type SelectionCreateInput,
  type SelectionUpdateInput,
} from "@/api/selections";
import { changeRequestKeys, selectionKeys } from "./query-keys";
import type { SelectionStatus } from "@/lib/project-types";

export type { SelectionOptionInput, SelectionCreateInput, SelectionUpdateInput };

export function useSelections(projectId: string | undefined, status?: SelectionStatus) {
  return useQuery({
    queryKey: selectionKeys.list(projectId ?? "__none__", status),
    queryFn: () => selectionsApi.list(projectId!, status),
    enabled: Boolean(projectId),
  });
}

export function useCreateSelection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...body }: SelectionCreateInput & { projectId: string }) =>
      selectionsApi.create(projectId, body),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: selectionKeys.all(projectId) }),
  });
}

export function useUpdateSelection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      selectionId,
      ...body
    }: SelectionUpdateInput & { projectId: string; selectionId: string }) =>
      selectionsApi.update(projectId, selectionId, body),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: selectionKeys.all(projectId) }),
  });
}

export function useDeleteSelection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, selectionId }: { projectId: string; selectionId: string }) =>
      selectionsApi.remove(projectId, selectionId),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: selectionKeys.all(projectId) }),
  });
}

export function useDecideSelection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      selectionId,
      optionId,
    }: {
      projectId: string;
      selectionId: string;
      optionId: string;
    }) =>
      selectionsApi.decide(projectId, selectionId, optionId),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: selectionKeys.all(projectId) }),
  });
}

export function useCreateSelectionChangeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, selectionId }: { projectId: string; selectionId: string }) =>
      selectionsApi.createChangeRequest(projectId, selectionId),
    onSuccess: (_d, { projectId }) => {
      qc.invalidateQueries({ queryKey: selectionKeys.all(projectId) });
      qc.invalidateQueries({ queryKey: changeRequestKeys.all(projectId) });
    },
  });
}
