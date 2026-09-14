import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contractsApi, type Contract, type CreateContractInput, type UpdateContractInput } from "@/api/contracts";
import { contractKeys, stageKeys } from "./query-keys";

export type { Contract, CreateContractInput, UpdateContractInput };

/**
 * The contracts endpoint may not be live yet: a failed list resolves to an
 * empty array (and does not retry) so the pages render with what they have.
 */
export function useContracts(projectId: string | undefined) {
  return useQuery({
    queryKey: contractKeys.list(projectId ?? "__none__"),
    queryFn: () => contractsApi.list(projectId!).catch(() => [] as Contract[]),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...body }: CreateContractInput & { projectId: string }) =>
      contractsApi.create(projectId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: contractKeys.all(projectId) });
    },
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      contractId,
      ...body
    }: UpdateContractInput & { projectId: string; contractId: string }) =>
      contractsApi.update(projectId, contractId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: contractKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: stageKeys.all(projectId) });
    },
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, contractId }: { projectId: string; contractId: string }) =>
      contractsApi.remove(projectId, contractId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: contractKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: stageKeys.all(projectId) });
    },
  });
}
