import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { suppliersApi, type SupplierInput } from "@/api/suppliers";
import { supplierKeys } from "./query-keys";

export type { SupplierInput };

export function useSuppliers(projectId: string | undefined, includeInactive = false) {
  return useQuery({
    queryKey: supplierKeys.list(projectId ?? "__none__", includeInactive),
    queryFn: () => suppliersApi.list(projectId!, includeInactive),
    enabled: Boolean(projectId),
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...body }: SupplierInput & { projectId: string }) =>
      suppliersApi.create(projectId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.all(projectId) });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      supplierId,
      ...body
    }: Partial<SupplierInput> & { projectId: string; supplierId: string; active?: boolean }) =>
      suppliersApi.update(projectId, supplierId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.all(projectId) });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, supplierId }: { projectId: string; supplierId: string }) =>
      suppliersApi.remove(projectId, supplierId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.all(projectId) });
    },
  });
}
