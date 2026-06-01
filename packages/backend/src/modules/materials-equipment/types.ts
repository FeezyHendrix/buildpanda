import type { Currency } from "../projects/types.ts";

export type MaterialOrderStatus =
  | "Draft"
  | "Requested"
  | "Approved"
  | "Ordered"
  | "PartiallyDelivered"
  | "Delivered"
  | "Cancelled";
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

export interface MaterialOrder extends LifecycleLinks {
  id: string;
  projectId: string;
  title: string;
  materialName: string;
  quantity: number;
  unit: string;
  supplier: string | null;
  status: MaterialOrderStatus;
  priority: RequestPriority;
  neededBy: string;
  orderedAt: string | null;
  expectedDeliveryAt: string | null;
  deliveredAt: string | null;
  estimatedCost: number;
  actualCost: number;
  currency: Currency;
  deliveryLocation: string | null;
  notes: string | null;
  requestedById: string | null;
  procurementId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentRequest extends LifecycleLinks {
  id: string;
  projectId: string;
  title: string;
  equipmentName: string;
  equipmentType: string;
  quantity: number;
  supplier: string | null;
  status: EquipmentRequestStatus;
  bucket: EquipmentBucket;
  priority: RequestPriority;
  neededFrom: string;
  neededUntil: string;
  mobilizedAt: string | null;
  returnedAt: string | null;
  estimatedCost: number;
  actualCost: number;
  currency: Currency;
  deliveryLocation: string | null;
  operatorRequired: boolean;
  notes: string | null;
  requestedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialOrderRow {
  id: string;
  project_id: string;
  title: string;
  material_name: string;
  quantity: string;
  unit: string;
  supplier: string | null;
  status: MaterialOrderStatus;
  priority: RequestPriority;
  phase_id: string | null;
  phase_name: string | null;
  activity_id: string | null;
  activity_name: string | null;
  document_id: string | null;
  document_name: string | null;
  requested_by_id: string | null;
  needed_by: string;
  ordered_at: string | null;
  expected_delivery_at: string | null;
  delivered_at: string | null;
  estimated_cost: string;
  actual_cost: string;
  currency: Currency;
  delivery_location: string | null;
  notes: string | null;
  procurement_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface EquipmentRequestRow {
  id: string;
  project_id: string;
  title: string;
  equipment_name: string;
  equipment_type: string;
  quantity: number;
  supplier: string | null;
  status: EquipmentRequestStatus;
  priority: RequestPriority;
  phase_id: string | null;
  phase_name: string | null;
  activity_id: string | null;
  activity_name: string | null;
  document_id: string | null;
  document_name: string | null;
  requested_by_id: string | null;
  needed_from: string;
  needed_until: string;
  mobilized_at: string | null;
  returned_at: string | null;
  estimated_cost: string;
  actual_cost: string;
  currency: Currency;
  delivery_location: string | null;
  operator_required: string;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}
