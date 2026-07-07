import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { purchaseOrdersApi, type PurchaseOrderInput } from "@/api/purchase-orders";

export type {
  PurchaseOrderStatus,
  PurchaseOrderItem,
  PurchaseOrder,
  PurchaseOrderItemInput,
  PurchaseOrderInput,
} from "@/api/purchase-orders";
import { purchaseOrderKeys } from "./query-keys";

export function usePurchaseOrders(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? purchaseOrderKeys.list(projectId)
      : purchaseOrderKeys.list("__none__"),
    queryFn: () => purchaseOrdersApi.list(projectId!),
    enabled: Boolean(projectId),
  });
}

interface CreatePurchaseOrderVariables extends PurchaseOrderInput {
  projectId: string;
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, ...body }: CreatePurchaseOrderVariables) => purchaseOrdersApi.create(projectId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.list(projectId) });
    },
  });
}

interface UpdatePurchaseOrderVariables extends PurchaseOrderInput {
  projectId: string;
  purchaseOrderId: string;
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, purchaseOrderId, ...body }: UpdatePurchaseOrderVariables) => purchaseOrdersApi.update(projectId, purchaseOrderId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.list(projectId) });
    },
  });
}

interface DeletePurchaseOrderVariables {
  projectId: string;
  purchaseOrderId: string;
}

export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, purchaseOrderId }: DeletePurchaseOrderVariables) => purchaseOrdersApi.delete(projectId, purchaseOrderId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.list(projectId) });
    },
  });
}
