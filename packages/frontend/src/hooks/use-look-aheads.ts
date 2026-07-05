import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { autoWindowKeys, lookAheadKeys } from "./query-keys";
import { lookAheadsApi, type LookAheadFilters } from "@/api/look-aheads";
import type {
  CreateLookAheadInput,
  UpdateLookAheadInput,
} from "@/lib/project-types";

export type { LookAheadFilters };

export function useAutoWindow(projectId: string | undefined, weeks = 4) {
  return useQuery({
    queryKey: autoWindowKeys.detail(projectId ?? "__none__", weeks),
    queryFn: () => lookAheadsApi.autoWindow(projectId!, weeks),
    enabled: Boolean(projectId),
  });
}

export function useLookAheads(projectId: string | undefined, filters: LookAheadFilters = {}) {
  const filterKey = JSON.stringify(filters);
  return useQuery({
    queryKey: lookAheadKeys.list(projectId ?? "__none__", filterKey),
    queryFn: () => lookAheadsApi.list(projectId!, filters),
    enabled: Boolean(projectId),
  });
}

export function useCreateLookAhead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...body }: CreateLookAheadInput & { projectId: string }) =>
      lookAheadsApi.create(projectId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: lookAheadKeys.all(projectId) });
    },
  });
}

export function useUpdateLookAhead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      lookAheadId,
      ...body
    }: UpdateLookAheadInput & { projectId: string; lookAheadId: string }) =>
      lookAheadsApi.update(projectId, lookAheadId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: lookAheadKeys.all(projectId) });
    },
  });
}

export function useDeleteLookAhead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, lookAheadId }: { projectId: string; lookAheadId: string }) =>
      lookAheadsApi.delete(projectId, lookAheadId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: lookAheadKeys.all(projectId) });
    },
  });
}
