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
  receivedQuantity: number;
  outstandingQuantity: number;
  /** More was signed for than was ordered — the QS has to reconcile it. */
  overReceived: boolean;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorName: string;
  supplierId: string | null;
  /** The approved material request this PO was raised from, when there was one. */
  materialOrderId: string | null;
  status: PurchaseOrderStatus;
  orderDate: string | null;
  expectedDate: string | null;
  issuedAt: string | null;
  issuedById: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  closedAt: string | null;
  overReceipt: boolean;
  /** Decided by the server: only an issued-or-later PO is committed spend. */
  committed: boolean;
  notes: string | null;
  stageId: string | null;
  stageName: string | null;
  total: number;
  receivedTotal: number;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

/**
 * No `status`: a PO is born Draft and moves only through issue / receive /
 * cancel / close, so the form never offers a status to type.
 */
export interface PurchaseOrderInput {
  poNumber?: string;
  vendorName: string;
  supplierId?: string | null;
  orderDate?: string;
  expectedDate?: string;
  notes?: string;
  stageId?: string | null;
  items: PurchaseOrderItemInput[];
}

export interface ReceiveLineInput {
  itemId: string;
  receivedQuantity: number;
}

export interface ReceivePurchaseOrderInput {
  lines: ReceiveLineInput[];
  receivedAt?: string;
  note?: string;
}

export interface RaisePurchaseOrderInput {
  poNumber?: string | null;
  expectedDate?: string | null;
  notes?: string | null;
}

const base = (projectId: string) => `/projects/${projectId}/purchase-orders`;

export const purchaseOrdersApi = {
  list: (projectId: string) =>
    api.get<PurchaseOrder[]>(base(projectId)).then(r => r.data),

  create: (projectId: string, body: PurchaseOrderInput) =>
    api.post<PurchaseOrder>(base(projectId), body).then(r => r.data),

  update: (projectId: string, purchaseOrderId: string, body: PurchaseOrderInput) =>
    api.put<PurchaseOrder>(`${base(projectId)}/${purchaseOrderId}`, body).then(r => r.data),

  issue: (projectId: string, purchaseOrderId: string, body: { issuedAt?: string } = {}) =>
    api.post<PurchaseOrder>(`${base(projectId)}/${purchaseOrderId}/issue`, body).then(r => r.data),

  receive: (projectId: string, purchaseOrderId: string, body: ReceivePurchaseOrderInput) =>
    api.post<PurchaseOrder>(`${base(projectId)}/${purchaseOrderId}/receive`, body).then(r => r.data),

  cancel: (projectId: string, purchaseOrderId: string, reason: string) =>
    api.post<PurchaseOrder>(`${base(projectId)}/${purchaseOrderId}/cancel`, { reason }).then(r => r.data),

  close: (projectId: string, purchaseOrderId: string) =>
    api.post<PurchaseOrder>(`${base(projectId)}/${purchaseOrderId}/close`).then(r => r.data),

  /** Raise a PO off an approved material request; the server copies the lines. */
  raiseFromMaterialOrder: (projectId: string, orderId: string, body: RaisePurchaseOrderInput = {}) =>
    api
      .post<PurchaseOrder>(`/projects/${projectId}/materials/orders/${orderId}/purchase-order`, body)
      .then(r => r.data),

  delete: (projectId: string, purchaseOrderId: string) =>
    api.delete(`${base(projectId)}/${purchaseOrderId}`).then(r => r.data),
};
