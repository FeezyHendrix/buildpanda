import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { supplierKeys } from "./query-keys";
import type { Supplier } from "@/lib/project-types";

export interface SupplierInput {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

export function useSuppliers(projectId: string | undefined, includeInactive = false) {
  return useQuery({
    queryKey: supplierKeys.list(projectId ?? "__none__", includeInactive),
    queryFn: async () => {
      const { data } = await api.get<Supplier[]>(`/projects/${projectId!}/suppliers`, {
        params: includeInactive ? { includeInactive } : undefined,
      });
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...body }: SupplierInput & { projectId: string }) => {
      const { data } = await api.post<Supplier>(`/projects/${projectId}/suppliers`, body);
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.all(projectId) });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      supplierId,
      ...body
    }: Partial<SupplierInput> & { projectId: string; supplierId: string; active?: boolean }) => {
      const { data } = await api.put<Supplier>(`/projects/${projectId}/suppliers/${supplierId}`, body);
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.all(projectId) });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, supplierId }: { projectId: string; supplierId: string }) => {
      await api.delete(`/projects/${projectId}/suppliers/${supplierId}`);
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.all(projectId) });
    },
  });
}
