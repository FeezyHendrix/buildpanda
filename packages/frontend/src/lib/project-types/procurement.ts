import type { Currency } from "./common";

export type MaterialOrderStatus =
  | "Draft"
  | "Requested"
  | "Approved"
  | "Ordered"
  | "PartiallyDelivered"
  | "Delivered"
  | "Cancelled"
  | "Rejected";
export type EquipmentRequestStatus =
  | "Draft"
  | "Requested"
  | "Approved"
  | "Scheduled"
  | "OnHire"
  | "Returned"
  | "Cancelled";
export type RequestPriority = "Low" | "Normal" | "High" | "Critical";
export type EquipmentBucket = "requests" | "approvals" | "schedule" | "on-hire" | "returns";

export interface LifecycleLinks {
  phaseId: string | null;
  phaseName: string | null;
  activityId: string | null;
  activityName: string | null;
  documentId: string | null;
  documentName: string | null;
}

/** One recorded drop against a material order — the goods actually arrived. */
export interface MaterialDelivery {
  id: string;
  orderId: string;
  deliveredQty: number;
  deliveredAt: string;
  deliveryNote: string | null;
  receivedById: string | null;
  receivedByName: string | null;
  notes: string | null;
  rejected: boolean;
  rejectedReason: string | null;
  ledgerEntryId: string | null;
  transactionId: string | null;
  createdAt: string;
}

export interface MaterialOrder extends LifecycleLinks {
  id: string;
  projectId: string;
  title: string;
  materialName: string;
  quantity: number;
  unit: string;
  /** Free-text fallback kept for rows typed before the supplier register. */
  supplier: string | null;
  supplierId: string | null;
  supplierName: string | null;
  status: MaterialOrderStatus;
  priority: RequestPriority;
  neededBy: string;
  orderedAt: string | null;
  expectedDeliveryAt: string | null;
  deliveredAt: string | null;
  unitRate: number | null;
  estimatedCost: number;
  actualCost: number;
  currency: Currency;
  deliveryLocation: string | null;
  notes: string | null;
  cancelReason: string | null;
  rejectedReason: string | null;
  requestedById: string | null;
  /** Computed by the backend, never stored: past its needed-by, or promised after it. */
  late: boolean;
  deliveredQuantity: number;
  outstandingQuantity: number;
  deliveries: MaterialDelivery[];
  /**
   * The material approval this order relies on — the newest request in its
   * resubmission chain — and its status. Null when none covers the material.
   */
  approvalId: string | null;
  approvalTitle: string | null;
  approvalStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One recorded push of the off-hire date, kept as an append-only log. */
export interface EquipmentHireExtension {
  at: string;
  from: string | null;
  to: string;
  reason: string | null;
  actorId: string | null;
}

export interface EquipmentRequest extends LifecycleLinks {
  id: string;
  projectId: string;
  title: string;
  equipmentName: string;
  equipmentType: string;
  quantity: number;
  supplier: string | null;
  supplierId: string | null;
  supplierName: string | null;
  status: EquipmentRequestStatus;
  bucket: EquipmentBucket;
  priority: RequestPriority;
  neededFrom: string;
  neededUntil: string;
  mobilizedAt: string | null;
  returnedAt: string | null;
  onHireAt: string | null;
  offHireAt: string | null;
  plantRef: string | null;
  dailyRate: number | null;
  hireDays: number | null;
  extensions: EquipmentHireExtension[];
  estimatedCost: number;
  actualCost: number;
  currency: Currency;
  deliveryLocation: string | null;
  operatorRequired: boolean;
  notes: string | null;
  cancelReason: string | null;
  rejectedReason: string | null;
  requestedById: string | null;
  /** Computed server-side: wanted on site before today and not yet on hire. */
  late: boolean;
  createdAt: string;
  updatedAt: string;
}
