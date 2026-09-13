import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  purchaseOrdersApi,
  type PurchaseOrderInput,
  type RaisePurchaseOrderInput,
  type ReceivePurchaseOrderInput,
} from "@/api/purchase-orders";

export type {
  PurchaseOrderStatus,
  PurchaseOrderItem,
  PurchaseOrder,
  PurchaseOrderItemInput,
  PurchaseOrderInput,
  ReceiveLineInput,
  ReceivePurchaseOrderInput,
  RaisePurchaseOrderInput,
} from "@/api/purchase-orders";
import { financeKeys, materialKeys, purchaseOrderKeys } from "./query-keys";

export function usePurchaseOrders(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? purchaseOrderKeys.list(projectId)
      : purchaseOrderKeys.list("__none__"),
    queryFn: () => purchaseOrdersApi.list(projectId!),
    enabled: Boolean(projectId),
  });
}

/**
 * Every PO write moves committed spend, which the finance pages read from the
 * API rather than recompute, so they all invalidate the same two caches.
 */
function useProjectPurchaseOrderMutation<TVariables extends { projectId: string }, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: financeKeys.all(projectId) });
    },
  });
}

export function useCreatePurchaseOrder() {
  return useProjectPurchaseOrderMutation(
    ({ projectId, ...body }: PurchaseOrderInput & { projectId: string }) =>
      purchaseOrdersApi.create(projectId, body),
  );
}

export function useUpdatePurchaseOrder() {
  return useProjectPurchaseOrderMutation(
    ({
      projectId,
      purchaseOrderId,
      ...body
    }: PurchaseOrderInput & { projectId: string; purchaseOrderId: string }) =>
      purchaseOrdersApi.update(projectId, purchaseOrderId, body),
  );
}

export function useIssuePurchaseOrder() {
  return useProjectPurchaseOrderMutation(
    ({
      projectId,
      purchaseOrderId,
      issuedAt,
    }: {
      projectId: string;
      purchaseOrderId: string;
      issuedAt?: string;
    }) => purchaseOrdersApi.issue(projectId, purchaseOrderId, issuedAt ? { issuedAt } : {}),
  );
}

export function useReceivePurchaseOrder() {
  return useProjectPurchaseOrderMutation(
    ({
      projectId,
      purchaseOrderId,
      ...body
    }: ReceivePurchaseOrderInput & { projectId: string; purchaseOrderId: string }) =>
      purchaseOrdersApi.receive(projectId, purchaseOrderId, body),
  );
}

export function useCancelPurchaseOrder() {
  return useProjectPurchaseOrderMutation(
    ({
      projectId,
      purchaseOrderId,
      reason,
    }: {
      projectId: string;
      purchaseOrderId: string;
      reason: string;
    }) => purchaseOrdersApi.cancel(projectId, purchaseOrderId, reason),
  );
}

export function useClosePurchaseOrder() {
  return useProjectPurchaseOrderMutation(
    ({ projectId, purchaseOrderId }: { projectId: string; purchaseOrderId: string }) =>
      purchaseOrdersApi.close(projectId, purchaseOrderId),
  );
}

/** Raising a PO off an approved material request also re-reads that order. */
export function useRaisePurchaseOrderFromOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      orderId,
      ...body
    }: RaisePurchaseOrderInput & { projectId: string; orderId: string }) =>
      purchaseOrdersApi.raiseFromMaterialOrder(projectId, orderId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: materialKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: financeKeys.all(projectId) });
    },
  });
}

export function useDeletePurchaseOrder() {
  return useProjectPurchaseOrderMutation(
    ({ projectId, purchaseOrderId }: { projectId: string; purchaseOrderId: string }) =>
      purchaseOrdersApi.delete(projectId, purchaseOrderId),
  );
}
