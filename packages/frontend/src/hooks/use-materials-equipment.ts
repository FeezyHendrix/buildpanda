import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { equipmentRequestKeys, financeKeys, materialKeys } from "./query-keys";
import type {
  EquipmentBucket,
  EquipmentRequest,
  EquipmentRequestStatus,
  MaterialOrder,
  MaterialOrderStatus,
  RequestPriority,
} from "@/lib/project-types";

export interface MaterialOrderInput {
  title: string;
  materialName: string;
  quantity: number;
  unit: string;
  supplier?: string | null;
  status?: MaterialOrderStatus;
  priority?: RequestPriority;
  phaseId?: string | null;
  activityId?: string | null;
  documentId?: string | null;
  neededBy: string;
  orderedAt?: string | null;
  expectedDeliveryAt?: string | null;
  deliveredAt?: string | null;
  estimatedCost?: number;
  actualCost?: number;
  currency?: "NGN" | "USD";
  deliveryLocation?: string | null;
  notes?: string | null;
}

export interface EquipmentRequestInput {
  title: string;
  equipmentName: string;
  equipmentType: string;
  quantity?: number;
  supplier?: string | null;
  status?: EquipmentRequestStatus;
  priority?: RequestPriority;
  phaseId?: string | null;
  activityId?: string | null;
  documentId?: string | null;
  neededFrom: string;
  neededUntil: string;
  mobilizedAt?: string | null;
  returnedAt?: string | null;
  estimatedCost?: number;
  actualCost?: number;
  currency?: "NGN" | "USD";
  deliveryLocation?: string | null;
  operatorRequired?: boolean;
  notes?: string | null;
}

export function useMaterialOrders(
  projectId: string | undefined,
  status?: MaterialOrderStatus,
) {
  return useQuery({
    queryKey: materialKeys.orders(projectId ?? "__none__", status),
    queryFn: async () => {
      const { data } = await api.get<MaterialOrder[]>(
        `/projects/${projectId!}/materials/orders`,
        { params: status ? { status } : undefined },
      );
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useCreateMaterialOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...body }: MaterialOrderInput & { projectId: string }) => {
      const { data } = await api.post<MaterialOrder>(`/projects/${projectId}/materials/orders`, body);
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: materialKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: financeKeys.all(projectId) });
    },
  });
}

export interface ParsedBoqMaterial {
  materialName: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
  supplier: string | null;
}

export type BoqJobStatus = "pending" | "processing" | "completed" | "failed";

export interface BoqImportJob {
  id: string;
  status: BoqJobStatus;
  fileName: string;
  materials: ParsedBoqMaterial[];
  materialCount: number;
  usedAi: boolean;
  error: string | null;
}

export function useStartBoqImport() {
  return useMutation({
    mutationFn: async ({ projectId, file }: { projectId: string; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post<BoqImportJob>(
        `/projects/${projectId}/materials/import`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    },
  });
}

export function useBoqImportJob(
  projectId: string | undefined,
  jobId: string | null,
) {
  return useQuery({
    queryKey: ["projects", projectId ?? "__none__", "boq-import", jobId ?? "__none__"],
    queryFn: async () => {
      const { data } = await api.get<BoqImportJob>(
        `/projects/${projectId!}/materials/import/${jobId!}`,
      );
      return data;
    },
    enabled: Boolean(projectId && jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "processing" ? 1500 : false;
    },
  });
}

export function useBulkCreateMaterials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      materials,
    }: {
      projectId: string;
      materials: ParsedBoqMaterial[];
    }) => {
      const { data } = await api.post<{ created: number }>(
        `/projects/${projectId}/materials/bulk`,
        { materials },
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: materialKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: financeKeys.all(projectId) });
    },
  });
}

export function useUpdateMaterialOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      orderId,
      ...body
    }: Partial<MaterialOrderInput> & { projectId: string; orderId: string }) => {
      const { data } = await api.patch<MaterialOrder>(
        `/projects/${projectId}/materials/orders/${orderId}`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: materialKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: financeKeys.all(projectId) });
    },
  });
}

export function useDeleteMaterialOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, orderId }: { projectId: string; orderId: string }) => {
      await api.delete(`/projects/${projectId}/materials/orders/${orderId}`);
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: materialKeys.all(projectId) });
    },
  });
}

export function useEquipmentRequests(
  projectId: string | undefined,
  bucket?: EquipmentBucket,
) {
  return useQuery({
    queryKey: equipmentRequestKeys.list(projectId ?? "__none__", bucket),
    queryFn: async () => {
      const { data } = await api.get<EquipmentRequest[]>(
        `/projects/${projectId!}/equipment-requests`,
        { params: bucket ? { bucket } : undefined },
      );
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useCreateEquipmentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...body }: EquipmentRequestInput & { projectId: string }) => {
      const { data } = await api.post<EquipmentRequest>(`/projects/${projectId}/equipment-requests`, body);
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: equipmentRequestKeys.all(projectId) });
    },
  });
}

export function useUpdateEquipmentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      requestId,
      ...body
    }: Partial<EquipmentRequestInput> & { projectId: string; requestId: string }) => {
      const { data } = await api.patch<EquipmentRequest>(
        `/projects/${projectId}/equipment-requests/${requestId}`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: equipmentRequestKeys.all(projectId) });
    },
  });
}

export function useDeleteEquipmentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, requestId }: { projectId: string; requestId: string }) => {
      await api.delete(`/projects/${projectId}/equipment-requests/${requestId}`);
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: equipmentRequestKeys.all(projectId) });
    },
  });
}
