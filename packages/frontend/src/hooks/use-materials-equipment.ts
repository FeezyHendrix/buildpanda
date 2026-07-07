import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { materialsEquipmentApi, type MaterialOrderInput, type EquipmentRequestInput, type ParsedBoqMaterial } from "@/api/materials-equipment";

export type {
  MaterialOrderInput,
  EquipmentRequestInput,
  ParsedBoqMaterial,
  BoqMaterialOption,
  BoqJobStatus,
  BoqImportJob,
} from "@/api/materials-equipment";
import { equipmentRequestKeys, financeKeys, materialKeys } from "./query-keys";
import type {
  EquipmentBucket,
  MaterialOrderStatus,
} from "@/lib/project-types";

export function useMaterialOrders(
  projectId: string | undefined,
  status?: MaterialOrderStatus,
) {
  return useQuery({
    queryKey: materialKeys.orders(projectId ?? "__none__", status),
    queryFn: () => materialsEquipmentApi.listMaterialOrders(projectId!, status),
    enabled: Boolean(projectId),
  });
}

export function useProjectBoqMaterials(projectId: string | undefined) {
  return useQuery({
    queryKey: materialKeys.boqMaterials(projectId ?? "__none__"),
    queryFn: () => materialsEquipmentApi.listBoqMaterials(projectId!),
    enabled: Boolean(projectId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateMaterialOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...body }: MaterialOrderInput & { projectId: string }) => materialsEquipmentApi.createMaterialOrder(projectId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: materialKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: financeKeys.all(projectId) });
    },
  });
}

export function useStartBoqImport() {
  return useMutation({
    mutationFn: ({ projectId, file }: { projectId: string; file: File }) => materialsEquipmentApi.startBoqImport(projectId, file),
  });
}

export function useBoqImportJob(
  projectId: string | undefined,
  jobId: string | null,
) {
  return useQuery({
    queryKey: ["projects", projectId ?? "__none__", "boq-import", jobId ?? "__none__"],
    queryFn: () => materialsEquipmentApi.getBoqImportJob(projectId!, jobId!),
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
    mutationFn: ({ projectId, materials }: { projectId: string; materials: ParsedBoqMaterial[] }) => materialsEquipmentApi.bulkCreateMaterials(projectId, materials),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: materialKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: financeKeys.all(projectId) });
    },
  });
}

export function useUpdateMaterialOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, orderId, ...body }: Partial<MaterialOrderInput> & { projectId: string; orderId: string }) => materialsEquipmentApi.updateMaterialOrder(projectId, orderId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: materialKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: financeKeys.all(projectId) });
    },
  });
}

export function useDeleteMaterialOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, orderId }: { projectId: string; orderId: string }) => materialsEquipmentApi.deleteMaterialOrder(projectId, orderId),
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
    queryFn: () => materialsEquipmentApi.listEquipmentRequests(projectId!, bucket),
    enabled: Boolean(projectId),
  });
}

export function useCreateEquipmentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...body }: EquipmentRequestInput & { projectId: string }) => materialsEquipmentApi.createEquipmentRequest(projectId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: equipmentRequestKeys.all(projectId) });
    },
  });
}

export function useUpdateEquipmentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, requestId, ...body }: Partial<EquipmentRequestInput> & { projectId: string; requestId: string }) => materialsEquipmentApi.updateEquipmentRequest(projectId, requestId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: equipmentRequestKeys.all(projectId) });
    },
  });
}

export function useDeleteEquipmentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, requestId }: { projectId: string; requestId: string }) => materialsEquipmentApi.deleteEquipmentRequest(projectId, requestId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: equipmentRequestKeys.all(projectId) });
    },
  });
}
