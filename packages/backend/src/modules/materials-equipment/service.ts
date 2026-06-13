import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors.ts";
import type { CurrencyCode } from "../../lib/currencies.ts";
import { generateId } from "../../lib/ids.ts";
import type { MaterialsEquipmentRepository } from "./repository.ts";
import type {
  EquipmentBucket,
  EquipmentRequest,
  EquipmentRequestRow,
  EquipmentRequestStatus,
  MaterialOrder,
  MaterialOrderRow,
  MaterialOrderStatus,
  RequestPriority,
} from "./types.ts";

export interface CreateMaterialOrderInput {
  title: string;
  materialName: string;
  quantity: number;
  unit: string;
  supplier?: string | null;
  status?: MaterialOrderStatus;
  priority?: RequestPriority;
  phaseId?: string | null;
  activityId?: string | null;
  documentId?: string | null;
  neededBy: string;
  orderedAt?: string | null;
  expectedDeliveryAt?: string | null;
  deliveredAt?: string | null;
  estimatedCost?: number;
  actualCost?: number;
  currency?: CurrencyCode;
  deliveryLocation?: string | null;
  notes?: string | null;
}

export type UpdateMaterialOrderInput = Partial<CreateMaterialOrderInput>;

export interface CreateEquipmentRequestInput {
  title: string;
  equipmentName: string;
  equipmentType: string;
  quantity?: number;
  supplier?: string | null;
  status?: EquipmentRequestStatus;
  priority?: RequestPriority;
  phaseId?: string | null;
  activityId?: string | null;
  documentId?: string | null;
  neededFrom: string;
  neededUntil: string;
  mobilizedAt?: string | null;
  returnedAt?: string | null;
  estimatedCost?: number;
  actualCost?: number;
  currency?: CurrencyCode;
  deliveryLocation?: string | null;
  operatorRequired?: boolean;
  notes?: string | null;
}

export type UpdateEquipmentRequestInput = Partial<CreateEquipmentRequestInput>;

const MATERIAL_FORWARD: Record<MaterialOrderStatus, MaterialOrderStatus[]> = {
  Draft: ["Requested", "Cancelled"],
  Requested: ["Approved", "Cancelled"],
  Approved: ["Ordered", "Cancelled"],
  Ordered: ["PartiallyDelivered", "Delivered", "Cancelled"],
  PartiallyDelivered: ["Delivered", "Cancelled"],
  Delivered: [],
  Cancelled: [],
};

const EQUIPMENT_FORWARD: Record<EquipmentRequestStatus, EquipmentRequestStatus[]> = {
  Draft: ["Requested", "Cancelled"],
  Requested: ["Approved", "Cancelled"],
  Approved: ["Scheduled", "Cancelled"],
  Scheduled: ["OnHire", "Cancelled"],
  OnHire: ["Returned", "Cancelled"],
  Returned: [],
  Cancelled: [],
};

function num(value: string): number {
  return Number(value);
}

function money(value: number | undefined): string {
  return String(value ?? 0);
}

function optionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredText(value: string): string {
  return value.trim();
}

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

function equipmentBucket(status: EquipmentRequestStatus): EquipmentBucket {
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
      return "returns";
  }
}

function toMaterialOrder(row: MaterialOrderRow): MaterialOrder {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    materialName: row.material_name,
    quantity: num(row.quantity),
    unit: row.unit,
    supplier: row.supplier,
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
    estimatedCost: num(row.estimated_cost),
    actualCost: num(row.actual_cost),
    currency: row.currency,
    deliveryLocation: row.delivery_location,
    notes: row.notes,
    requestedById: row.requested_by_id,
    procurementId: row.procurement_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function toEquipmentRequest(row: EquipmentRequestRow): EquipmentRequest {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    equipmentName: row.equipment_name,
    equipmentType: row.equipment_type,
    quantity: row.quantity,
    supplier: row.supplier,
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
    estimatedCost: num(row.estimated_cost),
    actualCost: num(row.actual_cost),
    currency: row.currency,
    deliveryLocation: row.delivery_location,
    operatorRequired: row.operator_required === "Yes",
    notes: row.notes,
    requestedById: row.requested_by_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function assertMaterialTransition(from: MaterialOrderStatus, to: MaterialOrderStatus): void {
  if (from === to) return;
  if (!MATERIAL_FORWARD[from].includes(to)) {
    throw new ConflictError(`Cannot move material order from ${from} to ${to}`);
  }
}

function assertEquipmentTransition(from: EquipmentRequestStatus, to: EquipmentRequestStatus): void {
  if (from === to) return;
  if (!EQUIPMENT_FORWARD[from].includes(to)) {
    throw new ConflictError(`Cannot move equipment request from ${from} to ${to}`);
  }
}

function assertDateOrder(start: string, end: string, label: string): void {
  if (new Date(start) > new Date(end)) {
    throw new BadRequestError(`${label} end must be on or after start`);
  }
}

export function materialsEquipmentService(repository: MaterialsEquipmentRepository) {
  async function materialRow(projectId: string, orderId: string): Promise<MaterialOrderRow> {
    const row = await repository.findMaterialOrder(orderId);
    if (!row || row.project_id !== projectId) throw new NotFoundError("Material order");
    return row;
  }

  async function equipmentRow(projectId: string, requestId: string): Promise<EquipmentRequestRow> {
    const row = await repository.findEquipmentRequest(requestId);
    if (!row || row.project_id !== projectId) throw new NotFoundError("Equipment request");
    return row;
  }

  return {
    async listMaterialOrders(projectId: string, status?: MaterialOrderStatus): Promise<MaterialOrder[]> {
      const rows = await repository.listMaterialOrders(projectId, status);
      return rows.map(toMaterialOrder);
    },

    async createMaterialOrder(projectId: string, input: CreateMaterialOrderInput, userId: string): Promise<MaterialOrder> {
      const status = input.status ?? "Requested";
      const row = await repository.createMaterialOrder({
        id: generateId("mo"),
        project_id: projectId,
        title: requiredText(input.title),
        material_name: requiredText(input.materialName),
        quantity: String(input.quantity),
        unit: requiredText(input.unit),
        supplier: optionalText(input.supplier) ?? null,
        status,
        priority: input.priority ?? "Normal",
        phase_id: input.phaseId ?? null,
        activity_id: input.activityId ?? null,
        document_id: input.documentId ?? null,
        requested_by_id: userId,
        needed_by: input.neededBy,
        ordered_at: input.orderedAt ?? null,
        expected_delivery_at: input.expectedDeliveryAt ?? null,
        delivered_at: input.deliveredAt ?? null,
        estimated_cost: money(input.estimatedCost),
        actual_cost: money(input.actualCost),
        currency: input.currency ?? "NGN",
        delivery_location: optionalText(input.deliveryLocation) ?? null,
        notes: optionalText(input.notes) ?? null,
      });
      if (status === "Delivered") await repository.createMaterialProcurementFromOrder(row);
      return toMaterialOrder(row);
    },

    async bulkCreateMaterialOrders(
      projectId: string,
      inputs: CreateMaterialOrderInput[],
      userId: string,
    ): Promise<number> {
      let created = 0;
      for (const input of inputs) {
        await this.createMaterialOrder(projectId, input, userId);
        created += 1;
      }
      return created;
    },

    async updateMaterialOrder(projectId: string, orderId: string, input: UpdateMaterialOrderInput): Promise<MaterialOrder> {
      const current = await materialRow(projectId, orderId);
      if (input.status) assertMaterialTransition(current.status, input.status);
      const row = await repository.updateMaterialOrder(orderId, {
        ...(input.title !== undefined ? { title: requiredText(input.title) } : {}),
        ...(input.materialName !== undefined ? { material_name: requiredText(input.materialName) } : {}),
        ...(input.quantity !== undefined ? { quantity: String(input.quantity) } : {}),
        ...(input.unit !== undefined ? { unit: requiredText(input.unit) } : {}),
        ...(input.supplier !== undefined ? { supplier: optionalText(input.supplier) ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.phaseId !== undefined ? { phase_id: input.phaseId } : {}),
        ...(input.activityId !== undefined ? { activity_id: input.activityId } : {}),
        ...(input.documentId !== undefined ? { document_id: input.documentId } : {}),
        ...(input.neededBy !== undefined ? { needed_by: input.neededBy } : {}),
        ...(input.orderedAt !== undefined ? { ordered_at: input.orderedAt } : {}),
        ...(input.expectedDeliveryAt !== undefined ? { expected_delivery_at: input.expectedDeliveryAt } : {}),
        ...(input.deliveredAt !== undefined ? { delivered_at: input.deliveredAt } : {}),
        ...(input.estimatedCost !== undefined ? { estimated_cost: money(input.estimatedCost) } : {}),
        ...(input.actualCost !== undefined ? { actual_cost: money(input.actualCost) } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.deliveryLocation !== undefined ? { delivery_location: optionalText(input.deliveryLocation) ?? null } : {}),
        ...(input.notes !== undefined ? { notes: optionalText(input.notes) ?? null } : {}),
      });
      if (!row) throw new NotFoundError("Material order");
      if (row.status === "Delivered") await repository.createMaterialProcurementFromOrder(row);
      return toMaterialOrder(row);
    },

    async deleteMaterialOrder(projectId: string, orderId: string): Promise<void> {
      await materialRow(projectId, orderId);
      await repository.deleteMaterialOrder(orderId);
    },

    async listEquipmentRequests(projectId: string, bucket?: EquipmentBucket): Promise<EquipmentRequest[]> {
      const rows = await repository.listEquipmentRequests(projectId, bucket);
      return rows.map(toEquipmentRequest);
    },

    async createEquipmentRequest(projectId: string, input: CreateEquipmentRequestInput, userId: string): Promise<EquipmentRequest> {
      assertDateOrder(input.neededFrom, input.neededUntil, "Equipment rental");
      const row = await repository.createEquipmentRequest({
        id: generateId("er"),
        project_id: projectId,
        title: requiredText(input.title),
        equipment_name: requiredText(input.equipmentName),
        equipment_type: requiredText(input.equipmentType),
        quantity: input.quantity ?? 1,
        supplier: optionalText(input.supplier) ?? null,
        status: input.status ?? "Requested",
        priority: input.priority ?? "Normal",
        phase_id: input.phaseId ?? null,
        activity_id: input.activityId ?? null,
        document_id: input.documentId ?? null,
        requested_by_id: userId,
        needed_from: input.neededFrom,
        needed_until: input.neededUntil,
        mobilized_at: input.mobilizedAt ?? null,
        returned_at: input.returnedAt ?? null,
        estimated_cost: money(input.estimatedCost),
        actual_cost: money(input.actualCost),
        currency: input.currency ?? "NGN",
        delivery_location: optionalText(input.deliveryLocation) ?? null,
        operator_required: input.operatorRequired ? "Yes" : "No",
        notes: optionalText(input.notes) ?? null,
      });
      return toEquipmentRequest(row);
    },

    async updateEquipmentRequest(projectId: string, requestId: string, input: UpdateEquipmentRequestInput): Promise<EquipmentRequest> {
      const current = await equipmentRow(projectId, requestId);
      if (input.status) assertEquipmentTransition(current.status, input.status);
      const start = input.neededFrom ?? current.needed_from;
      const end = input.neededUntil ?? current.needed_until;
      assertDateOrder(start, end, "Equipment rental");
      const row = await repository.updateEquipmentRequest(requestId, {
        ...(input.title !== undefined ? { title: requiredText(input.title) } : {}),
        ...(input.equipmentName !== undefined ? { equipment_name: requiredText(input.equipmentName) } : {}),
        ...(input.equipmentType !== undefined ? { equipment_type: requiredText(input.equipmentType) } : {}),
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.supplier !== undefined ? { supplier: optionalText(input.supplier) ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.phaseId !== undefined ? { phase_id: input.phaseId } : {}),
        ...(input.activityId !== undefined ? { activity_id: input.activityId } : {}),
        ...(input.documentId !== undefined ? { document_id: input.documentId } : {}),
        ...(input.neededFrom !== undefined ? { needed_from: input.neededFrom } : {}),
        ...(input.neededUntil !== undefined ? { needed_until: input.neededUntil } : {}),
        ...(input.mobilizedAt !== undefined ? { mobilized_at: input.mobilizedAt } : {}),
        ...(input.returnedAt !== undefined ? { returned_at: input.returnedAt } : {}),
        ...(input.estimatedCost !== undefined ? { estimated_cost: money(input.estimatedCost) } : {}),
        ...(input.actualCost !== undefined ? { actual_cost: money(input.actualCost) } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.deliveryLocation !== undefined ? { delivery_location: optionalText(input.deliveryLocation) ?? null } : {}),
        ...(input.operatorRequired !== undefined ? { operator_required: input.operatorRequired ? "Yes" : "No" } : {}),
        ...(input.notes !== undefined ? { notes: optionalText(input.notes) ?? null } : {}),
      });
      if (!row) throw new NotFoundError("Equipment request");
      return toEquipmentRequest(row);
    },

    async deleteEquipmentRequest(projectId: string, requestId: string): Promise<void> {
      await equipmentRow(projectId, requestId);
      await repository.deleteEquipmentRequest(requestId);
    },
  };
}

export type MaterialsEquipmentService = ReturnType<typeof materialsEquipmentService>;
