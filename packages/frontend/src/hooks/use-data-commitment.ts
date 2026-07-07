import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dataCommitmentApi } from "@/api/data-commitment";

const dataCommitmentKey = ["data-commitment", "status"] as const;

export function useDataCommitment(enabled: boolean) {
  return useQuery({
    queryKey: dataCommitmentKey,
    queryFn: () => dataCommitmentApi.status(),
    enabled,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

export function useAcceptDataCommitment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => dataCommitmentApi.accept(),
    onSuccess: (status) => qc.setQueryData(dataCommitmentKey, status),
  });
}
