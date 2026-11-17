import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productDiscoveryApi, type DiscoveryInput, type DiscoveryStatus } from "@/api/product-discovery";
import { productDiscoveryKeys } from "@/hooks/query-keys";

export function useProductDiscovery() {
  // Never refetched: the answer only changes when this client saves, and a refetch mid-survey would close it.
  return useQuery({
    queryKey: productDiscoveryKeys.status(),
    queryFn: () => productDiscoveryApi.status(),
    staleTime: Infinity,
    retry: false,
  });
}

export function useSaveProductDiscovery() {
  return useMutation({ mutationFn: (body: DiscoveryInput) => productDiscoveryApi.save(body) });
}

/** Stops the survey showing again this session, including after the dashboard remounts. */
export function useCloseProductDiscovery() {
  const qc = useQueryClient();
  return () =>
    qc.setQueryData<DiscoveryStatus>(productDiscoveryKeys.status(), (prev) => (prev ? { ...prev, due: false } : prev));
}
