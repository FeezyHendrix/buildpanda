import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rfisApi, type UpsertRfiInput } from "@/api/rfis";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";
import { rfiKeys } from "./query-keys";

export function useRfis(projectId: string | undefined, enabled = true) {
  const { storageOwnerId } = useFieldSession();
  return usePersistentQuery({
    queryKey: rfiKeys.list(projectId),
    ownerId: storageOwnerId,
    queryFn: () => rfisApi.list(projectId!),
    enabled: enabled && Boolean(projectId),
  });
}

export function useCreateRfi(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertRfiInput) => rfisApi.create(projectId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rfiKeys.all(projectId) });
    },
  });
}

export function useUpdateRfi(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<UpsertRfiInput> }) =>
      rfisApi.update(projectId!, id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rfiKeys.all(projectId) });
    },
  });
}
