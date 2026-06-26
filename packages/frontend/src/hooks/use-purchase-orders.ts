import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { purchaseOrderKeys } from "./query-keys";

export type PurchaseOrderStatus =
  | "Draft"
  | "Issued"
  | "PartiallyReceived"
  | "Received"
  | "Closed"
  | "Cancelled";

export interface PurchaseOrderItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorName: string;
  status: PurchaseOrderStatus;
  orderDate: string | null;
  expectedDate: string | null;
  notes: string | null;
  total: number;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface PurchaseOrderInput {
  poNumber: string;
  vendorName: string;
  status: PurchaseOrderStatus;
  orderDate?: string;
  expectedDate?: string;
  notes?: string;
  items: PurchaseOrderItemInput[];
}

export function usePurchaseOrders(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? purchaseOrderKeys.list(projectId)
      : purchaseOrderKeys.list("__none__"),
    queryFn: async () => {
      const { data } = await api.get<PurchaseOrder[]>(
        `/projects/${projectId!}/purchase-orders`,
      );
      return data;
    },
    enabled: Boolean(projectId),
  });
}

interface CreatePurchaseOrderVariables extends PurchaseOrderInput {
  projectId: string;
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, ...body }: CreatePurchaseOrderVariables) => {
      const { data } = await api.post<PurchaseOrder>(
        `/projects/${projectId}/purchase-orders`,
        body,
      );
      return data;
    },
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
    mutationFn: async ({
      projectId,
      purchaseOrderId,
      ...body
    }: UpdatePurchaseOrderVariables) => {
      const { data } = await api.put<PurchaseOrder>(
        `/projects/${projectId}/purchase-orders/${purchaseOrderId}`,
        body,
      );
      return data;
    },
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
    mutationFn: async ({ projectId, purchaseOrderId }: DeletePurchaseOrderVariables) => {
      await api.delete(`/projects/${projectId}/purchase-orders/${purchaseOrderId}`);
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.list(projectId) });
    },
  });
}
