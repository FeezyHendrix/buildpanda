import type { Currency } from "../projects/types.ts";

export const MATERIAL_ORDER_STATUSES = [
  "Draft",
  "Requested",
  "Approved",
  "Ordered",
  "PartiallyDelivered",
  "Delivered",
  "Cancelled",
  "Rejected",
] as const;

export const EQUIPMENT_REQUEST_STATUSES = [
  "Draft",
  "Requested",
  "Approved",
  "Scheduled",
  "OnHire",
  "Returned",
  "Cancelled",
  "Rejected",
] as const;

export type MaterialOrderStatus = (typeof MATERIAL_ORDER_STATUSES)[number];
export type EquipmentRequestStatus = (typeof EQUIPMENT_REQUEST_STATUSES)[number];

/** Terminal: nothing more happens to the record, only its history is read. */
export const TERMINAL_MATERIAL_STATUSES = ["Delivered", "Cancelled", "Rejected"] as const;
export const TERMINAL_EQUIPMENT_STATUSES = ["Returned", "Cancelled", "Rejected"] as const;

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
  procurementId: string | null;
  /** Computed, never stored: past its needed-by, or promised after it. */
  late: boolean;
  deliveredQuantity: number;
  outstandingQuantity: number;
  deliveries: MaterialDelivery[];
  /** Status of the material-approval request covering this material, if any. */
  approvalStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

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
  late: boolean;
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
  supplier_id: string | null;
  supplier_name: string | null;
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
  unit_rate: string | null;
  estimated_cost: string;
  actual_cost: string;
  currency: Currency;
  delivery_location: string | null;
  notes: string | null;
  cancel_reason: string | null;
  rejected_reason: string | null;
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
  supplier_id: string | null;
  supplier_name: string | null;
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
  on_hire_at: string | null;
  off_hire_at: string | null;
  plant_ref: string | null;
  daily_rate: string | null;
  extensions: EquipmentHireExtension[] | string | null;
  estimated_cost: string;
  actual_cost: string;
  currency: Currency;
  delivery_location: string | null;
  operator_required: string;
  notes: string | null;
  cancel_reason: string | null;
  rejected_reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface MaterialDeliveryRow {
  id: string;
  project_id: string;
  order_id: string;
  delivered_qty: string;
  delivered_at: string;
  delivery_note: string | null;
  received_by_id: string | null;
  received_by_name: string | null;
  notes: string | null;
  rejected: boolean;
  rejected_reason: string | null;
  ledger_entry_id: string | null;
  transaction_id: string | null;
  created_by_id: string | null;
  created_at: Date | string;
}

export interface RecordDeliveryInput {
  deliveredQty: number;
  deliveredAt: string;
  deliveryNote?: string | null;
  receivedById?: string | null;
  notes?: string | null;
  rejected?: boolean;
  rejectedReason?: string | null;
}

export interface ExtendHireInput {
  offHireAt: string;
  reason?: string | null;
}

export interface StatusReasonInput {
  reason: string;
}

export interface CreateMaterialOrderInput {
  title: string;
  materialName: string;
  quantity: number;
  unit: string;
  supplier?: string | null;
  supplierId?: string | null;
  status?: MaterialOrderStatus;
  priority?: RequestPriority;
  phaseId?: string | null;
  activityId?: string | null;
  documentId?: string | null;
  neededBy: string;
  orderedAt?: string | null;
  expectedDeliveryAt?: string | null;
  deliveredAt?: string | null;
  unitRate?: number | null;
  estimatedCost?: number;
  actualCost?: number;
  currency?: Currency;
  deliveryLocation?: string | null;
  notes?: string | null;
  invoiceId?: string | null;
  invoiceLineItemId?: string | null;
}

export type UpdateMaterialOrderInput = Partial<CreateMaterialOrderInput> & {
  /** Required when moving to Cancelled or Rejected. */
  reason?: string | null;
  /** Place the order despite an unresolved material approval. */
  force?: boolean;
  forceNote?: string | null;
};

export interface CreateEquipmentRequestInput {
  title: string;
  equipmentName: string;
  equipmentType: string;
  quantity?: number;
  supplier?: string | null;
  supplierId?: string | null;
  status?: EquipmentRequestStatus;
  priority?: RequestPriority;
  phaseId?: string | null;
  activityId?: string | null;
  documentId?: string | null;
  neededFrom: string;
  neededUntil: string;
  mobilizedAt?: string | null;
  returnedAt?: string | null;
  onHireAt?: string | null;
  offHireAt?: string | null;
  plantRef?: string | null;
  dailyRate?: number | null;
  estimatedCost?: number;
  actualCost?: number;
  currency?: Currency;
  deliveryLocation?: string | null;
  operatorRequired?: boolean;
  notes?: string | null;
}

export type UpdateEquipmentRequestInput = Partial<CreateEquipmentRequestInput> & {
  reason?: string | null;
};

export interface ImportedMaterial {
  materialName: string;
  quantity: number;
  unit: string;
  estimatedCost?: number;
  supplier?: string | null;
  neededBy?: string;
  section?: string | null;
}
