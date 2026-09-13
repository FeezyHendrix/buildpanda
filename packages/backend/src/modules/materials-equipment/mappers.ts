import { toIso } from "../../lib/dates.ts";
import {
  TERMINAL_EQUIPMENT_STATUSES,
  TERMINAL_MATERIAL_STATUSES,
  type EquipmentBucket,
  type EquipmentHireExtension,
  type EquipmentRequest,
  type EquipmentRequestRow,
  type EquipmentRequestStatus,
  type MaterialDelivery,
  type MaterialDeliveryRow,
  type MaterialOrder,
  type MaterialOrderRow,
} from "./types.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export function num(value: string): number {
  return Number(value);
}

export function numOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function optionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function requiredText(value: string): string {
  return value.trim();
}

export function equipmentBucket(status: EquipmentRequestStatus): EquipmentBucket {
  switch (status) {
    case "Draft":
    case "Requested":
      return "requests";
    case "Approved":
      return "schedule";
    case "Scheduled":
    case "OnHire":
      return "on-hire";
    case "Returned":
    case "Cancelled":
    case "Rejected":
      return "returns";
  }
}

/**
 * "Late" is a fact about dates, never a stored status: the goods were wanted
 * before today and have not arrived, or the supplier has promised them after
 * the date they were wanted.
 */
export function isMaterialOrderLate(row: MaterialOrderRow, now = today()): boolean {
  if ((TERMINAL_MATERIAL_STATUSES as readonly string[]).includes(row.status)) return false;
  if (row.needed_by < now) return true;
  return Boolean(row.expected_delivery_at && row.expected_delivery_at > row.needed_by);
}

export function isEquipmentLate(row: EquipmentRequestRow, now = today()): boolean {
  if ((TERMINAL_EQUIPMENT_STATUSES as readonly string[]).includes(row.status)) return false;
  if (row.status === "OnHire") return false;
  return row.needed_from < now;
}

export function parseExtensions(value: EquipmentRequestRow["extensions"]): EquipmentHireExtension[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as EquipmentHireExtension[]) : [];
  } catch {
    return [];
  }
}

/** Inclusive hire duration, the way a plant hire invoice counts days. */
export function hireDays(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / DAY_MS) + 1;
}

export function toDelivery(row: MaterialDeliveryRow): MaterialDelivery {
  return {
    id: row.id,
    orderId: row.order_id,
    deliveredQty: num(row.delivered_qty),
    deliveredAt: row.delivered_at,
    deliveryNote: row.delivery_note,
    receivedById: row.received_by_id,
    receivedByName: row.received_by_name,
    notes: row.notes,
    rejected: row.rejected,
    rejectedReason: row.rejected_reason,
    ledgerEntryId: row.ledger_entry_id,
    transactionId: row.transaction_id,
    createdAt: toIso(row.created_at),
  };
}

/** Only accepted loads count toward the order; a rejected load is a record. */
export function acceptedQuantity(deliveries: MaterialDeliveryRow[]): number {
  return deliveries
    .filter((d) => !d.rejected)
    .reduce((sum, d) => sum + num(d.delivered_qty), 0);
}

export function toMaterialOrder(
  row: MaterialOrderRow,
  deliveries: MaterialDeliveryRow[] = [],
  approvalStatus: string | null = null,
): MaterialOrder {
  const quantity = num(row.quantity);
  const delivered = acceptedQuantity(deliveries);
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    materialName: row.material_name,
    quantity,
    unit: row.unit,
    supplier: row.supplier_name ?? row.supplier,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    status: row.status,
    priority: row.priority,
    phaseId: row.phase_id,
    phaseName: row.phase_name,
    activityId: row.activity_id,
    activityName: row.activity_name,
    documentId: row.document_id,
    documentName: row.document_name,
    neededBy: row.needed_by,
    orderedAt: row.ordered_at,
    expectedDeliveryAt: row.expected_delivery_at,
    deliveredAt: row.delivered_at,
    unitRate: numOrNull(row.unit_rate),
    estimatedCost: num(row.estimated_cost),
    actualCost: num(row.actual_cost),
    currency: row.currency,
    deliveryLocation: row.delivery_location,
    notes: row.notes,
    cancelReason: row.cancel_reason,
    rejectedReason: row.rejected_reason,
    requestedById: row.requested_by_id,
    procurementId: row.procurement_id,
    late: isMaterialOrderLate(row),
    deliveredQuantity: delivered,
    outstandingQuantity: Math.max(0, Math.round((quantity - delivered) * 100) / 100),
    deliveries: deliveries.map(toDelivery),
    approvalStatus,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function toEquipmentRequest(row: EquipmentRequestRow): EquipmentRequest {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    equipmentName: row.equipment_name,
    equipmentType: row.equipment_type,
    quantity: row.quantity,
    supplier: row.supplier_name ?? row.supplier,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    status: row.status,
    bucket: equipmentBucket(row.status),
    priority: row.priority,
    phaseId: row.phase_id,
    phaseName: row.phase_name,
    activityId: row.activity_id,
    activityName: row.activity_name,
    documentId: row.document_id,
    documentName: row.document_name,
    neededFrom: row.needed_from,
    neededUntil: row.needed_until,
    mobilizedAt: row.mobilized_at,
    returnedAt: row.returned_at,
    onHireAt: row.on_hire_at,
    offHireAt: row.off_hire_at,
    plantRef: row.plant_ref,
    dailyRate: numOrNull(row.daily_rate),
    hireDays: hireDays(row.on_hire_at ?? row.needed_from, row.off_hire_at ?? row.needed_until),
    extensions: parseExtensions(row.extensions),
    estimatedCost: num(row.estimated_cost),
    actualCost: num(row.actual_cost),
    currency: row.currency,
    deliveryLocation: row.delivery_location,
    operatorRequired: row.operator_required === "Yes",
    notes: row.notes,
    cancelReason: row.cancel_reason,
    rejectedReason: row.rejected_reason,
    requestedById: row.requested_by_id,
    late: isEquipmentLate(row),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
