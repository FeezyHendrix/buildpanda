import api from "./client";

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

export const purchaseOrdersApi = {
  list: (projectId: string) =>
    api.get<PurchaseOrder[]>(`/projects/${projectId}/purchase-orders`).then(r => r.data),
    
  create: (projectId: string, body: PurchaseOrderInput) =>
    api.post<PurchaseOrder>(`/projects/${projectId}/purchase-orders`, body).then(r => r.data),
    
  update: (projectId: string, purchaseOrderId: string, body: PurchaseOrderInput) =>
    api.put<PurchaseOrder>(`/projects/${projectId}/purchase-orders/${purchaseOrderId}`, body).then(r => r.data),
    
  delete: (projectId: string, purchaseOrderId: string) =>
    api.delete(`/projects/${projectId}/purchase-orders/${purchaseOrderId}`).then(r => r.data),
};
