import { request } from "./client";

/** Mirrors MATERIAL_STATUS in the backend's materials-equipment routes. */
export const MATERIAL_ORDER_STATUSES = [
  "Draft",
  "Requested",
  "Approved",
  "Ordered",
  "PartiallyDelivered",
  "Delivered",
  "Cancelled",
] as const;
export type MaterialOrderStatus = (typeof MATERIAL_ORDER_STATUSES)[number];

/** Same wording as the web's materials page, so a status reads the same on both. */
export const MATERIAL_ORDER_STATUS_LABELS: Record<MaterialOrderStatus, string> = {
  Draft: "Draft",
  Requested: "Requested",
  Approved: "Approved",
  Ordered: "Ordered",
  PartiallyDelivered: "Partially delivered",
  Delivered: "Delivered",
  Cancelled: "Cancelled",
};

export function materialOrderStatusLabel(status: string): string {
  return (MATERIAL_ORDER_STATUS_LABELS as Record<string, string>)[status] ?? status;
}

/** Only an order that has been approved or placed can take a delivery. */
export function canRecordDelivery(status: string): boolean {
  return status === "Approved" || status === "Ordered" || status === "PartiallyDelivered";
}

export interface MaterialOrder {
  id: string;
  title: string;
  materialName: string;
  quantity: number;
  unit: string;
  supplier: string | null;
  status: string;
  phaseId: string | null;
  phaseName: string | null;
  neededBy: string;
  /** The material approval it relies on, newest in its resubmission chain. */
  approvalId: string | null;
  approvalTitle: string | null;
  approvalStatus: string | null;
  deliveredQuantity: number;
  outstandingQuantity: number;
}

export interface MaterialDelivery {
  id: string;
  deliveredQty: number;
  rejected: boolean;
}

export interface RecordDeliveryInput {
  deliveredQty: number;
  deliveredAt: string;
  deliveryNote?: string | null;
  notes?: string | null;
}

export interface CreateMaterialOrderInput {
  title: string;
  materialName: string;
  quantity: number;
  unit: string;
  neededBy: string;
  supplier?: string | null;
  phaseId?: string | null;
  status?: MaterialOrderStatus;
  /** Raised from an approved material request; matched by material when omitted. */
  approvalId?: string | null;
}

export const materialsApi = {
  list: (projectId: string) =>
    request<MaterialOrder[]>(`/projects/${projectId}/materials/orders`),

  create: (projectId: string, body: CreateMaterialOrderInput) =>
    request<MaterialOrder>(`/projects/${projectId}/materials/orders`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (projectId: string, orderId: string, body: Partial<CreateMaterialOrderInput>) =>
    request<MaterialOrder>(`/projects/${projectId}/materials/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  /** Goods received: books the stock and the cost and moves the order's status. */
  recordDelivery: (projectId: string, orderId: string, body: RecordDeliveryInput) =>
    request<MaterialOrder>(`/projects/${projectId}/materials/orders/${orderId}/deliveries`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deliveries: (projectId: string, orderId: string) =>
    request<MaterialDelivery[]>(`/projects/${projectId}/materials/orders/${orderId}/deliveries`),

  remove: (projectId: string, orderId: string) =>
    request<{ ok: boolean }>(`/projects/${projectId}/materials/orders/${orderId}`, {
      method: "DELETE",
    }),
};
