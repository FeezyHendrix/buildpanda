import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keyDatesApi, type KeyDateInput } from "@/api/key-dates";
import { keyDateKeys } from "./query-keys";

export function useKeyDates(projectId: string | undefined) {
  return useQuery({
    queryKey: keyDateKeys.list(projectId ?? "__none__"),
    queryFn: () => keyDatesApi.list(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useCreateKeyDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...body }: KeyDateInput & { projectId: string }) => 
      keyDatesApi.create(projectId, body),
    onSuccess: (_d, { projectId }) => qc.invalidateQueries({ queryKey: keyDateKeys.all(projectId) }),
  });
}

export function useUpdateKeyDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      keyDateId,
      ...body
    }: Partial<KeyDateInput> & { projectId: string; keyDateId: string }) => 
      keyDatesApi.update(projectId, keyDateId, body),
    onSuccess: (_d, { projectId }) => qc.invalidateQueries({ queryKey: keyDateKeys.all(projectId) }),
  });
}

export function useDeleteKeyDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, keyDateId }: { projectId: string; keyDateId: string }) => 
      keyDatesApi.delete(projectId, keyDateId),
    onSuccess: (_d, { projectId }) => qc.invalidateQueries({ queryKey: keyDateKeys.all(projectId) }),
  });
}
