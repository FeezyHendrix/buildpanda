import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { MaterialsEquipmentRepository } from "./repository.ts";
import { num, optionalText, requiredText, toMaterialOrder, today } from "./mappers.ts";
import {
  equipmentRequestService,
  type EquipmentServiceDeps,
} from "./equipment-service.ts";
import type {
  CreateMaterialOrderInput,
  MaterialDeliveryRow,
  MaterialOrder,
  MaterialOrderRow,
  MaterialOrderStatus,
  UpdateMaterialOrderInput,
} from "./types.ts";

// Re-exported so existing importers (routes, materials-ledger) keep working
// while the shapes themselves live in types.ts.
export type {
  CreateEquipmentRequestInput,
  CreateMaterialOrderInput,
  UpdateEquipmentRequestInput,
  UpdateMaterialOrderInput,
} from "./types.ts";

export interface MaterialsEquipmentDeps extends EquipmentServiceDeps {
  /** Resolves a supplier on the register to the name stored on the order. */
  supplierName?: (projectId: string, supplierId: string) => Promise<string | null>;
}

/**
 * Forward-only ladder. Cancelled and Rejected are reachable from any state that
 * has not already finished, because a job can be killed or a load refused at
 * any point — both carry a reason so the record explains itself. Ordered ->
 * Delivered is a legitimate single-drop delivery; nothing has to pretend to be
 * partial first.
 */
const MATERIAL_FORWARD: Record<MaterialOrderStatus, MaterialOrderStatus[]> = {
  Draft: ["Requested", "Cancelled", "Rejected"],
  Requested: ["Approved", "Cancelled", "Rejected"],
  Approved: ["Ordered", "Cancelled", "Rejected"],
  Ordered: ["PartiallyDelivered", "Delivered", "Cancelled", "Rejected"],
  PartiallyDelivered: ["Delivered", "Cancelled", "Rejected"],
  Delivered: [],
  Cancelled: [],
  Rejected: [],
};

const REASON_REQUIRED: MaterialOrderStatus[] = ["Cancelled", "Rejected"];

function money(value: number | undefined): string {
  return String(value ?? 0);
}

/** A priced order is rate × quantity; a lump sum is only a fallback. */
function costFor(unitRate: number | null | undefined, quantity: number, lump: number | undefined): string {
  if (unitRate !== null && unitRate !== undefined) {
    return String(Math.round(unitRate * quantity * 100) / 100);
  }
  return money(lump);
}

function assertMaterialTransition(from: MaterialOrderStatus, to: MaterialOrderStatus): void {
  if (from === to) return;
  if (!MATERIAL_FORWARD[from].includes(to)) {
    throw new ConflictError(`Cannot move material order from ${from} to ${to}`);
  }
}

export function materialsEquipmentService(
  repository: MaterialsEquipmentRepository,
  deps: MaterialsEquipmentDeps = {},
) {
  const equipment = equipmentRequestService(repository, deps);

  async function materialRow(projectId: string, orderId: string): Promise<MaterialOrderRow> {
    const row = await repository.findMaterialOrder(orderId);
    if (!row || row.project_id !== projectId) throw new NotFoundError("Material order");
    return row;
  }

  function approvalKey(materialName: string): string {
    return materialName.trim().toLowerCase();
  }

  async function hydrate(rows: MaterialOrderRow[]): Promise<MaterialOrder[]> {
    if (rows.length === 0) return [];
    const projectId = rows[0]!.project_id;
    const [deliveries, approvals] = await Promise.all([
      repository.listDeliveriesForOrders(rows.map((r) => r.id)),
      repository.approvalStatusByMaterial(projectId),
    ]);
    const byOrder = new Map<string, MaterialDeliveryRow[]>();
    for (const delivery of deliveries) {
      const bucket = byOrder.get(delivery.order_id);
      if (bucket) bucket.push(delivery);
      else byOrder.set(delivery.order_id, [delivery]);
    }
    return rows.map((row) =>
      toMaterialOrder(
        row,
        byOrder.get(row.id) ?? [],
        approvals.get(approvalKey(row.material_name)) ?? null,
      ),
    );
  }

  async function one(row: MaterialOrderRow): Promise<MaterialOrder> {
    const [order] = await hydrate([row]);
    if (!order) throw new NotFoundError("Material order");
    return order;
  }

  async function resolveSupplier(
    projectId: string,
    supplierId: string | null | undefined,
    fallback: string | null | undefined,
  ): Promise<{ supplier_id: string | null; supplier: string | null }> {
    if (supplierId) {
      const name = deps.supplierName ? await deps.supplierName(projectId, supplierId) : null;
      if (deps.supplierName && !name) throw new BadRequestError("Supplier is not on this project's register");
      return { supplier_id: supplierId, supplier: name ?? optionalText(fallback) ?? null };
    }
    return { supplier_id: null, supplier: optionalText(fallback) ?? null };
  }

  return {
    ...equipment,

    async listMaterialOrders(projectId: string, status?: MaterialOrderStatus): Promise<MaterialOrder[]> {
      return hydrate(await repository.listMaterialOrders(projectId, status));
    },

    async getMaterialOrder(projectId: string, orderId: string): Promise<MaterialOrder> {
      return one(await materialRow(projectId, orderId));
    },

    /** Orders past their needed-by, or promised late — the chase list. */
    async listLateMaterialOrders(projectId: string): Promise<MaterialOrder[]> {
      const orders = await this.listMaterialOrders(projectId);
      return orders.filter((order) => order.late);
    },

    async createMaterialOrder(
      projectId: string,
      input: CreateMaterialOrderInput,
      userId: string,
    ): Promise<MaterialOrder> {
      const status = input.status ?? "Requested";
      const supplier = await resolveSupplier(projectId, input.supplierId, input.supplier);
      const row = await repository.createMaterialOrder({
        id: generateId("mo"),
        project_id: projectId,
        title: requiredText(input.title),
        material_name: requiredText(input.materialName),
        quantity: String(input.quantity),
        unit: requiredText(input.unit),
        ...supplier,
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
        unit_rate: input.unitRate === null || input.unitRate === undefined ? null : String(input.unitRate),
        estimated_cost: costFor(input.unitRate, input.quantity, input.estimatedCost),
        actual_cost: money(input.actualCost),
        currency: input.currency ?? "NGN",
        delivery_location: optionalText(input.deliveryLocation) ?? null,
        notes: optionalText(input.notes) ?? null,
        cancel_reason: null,
        rejected_reason: null,
        invoice_id: input.invoiceId ?? null,
        invoice_line_item_id: input.invoiceLineItemId ?? null,
      });
      if (status === "Delivered") await repository.createMaterialProcurementFromOrder(row);
      return one(row);
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

    async updateMaterialOrder(
      projectId: string,
      orderId: string,
      input: UpdateMaterialOrderInput,
    ): Promise<MaterialOrder> {
      const current = await materialRow(projectId, orderId);
      const reason = optionalText(input.reason) ?? null;
      if (input.status) {
        assertMaterialTransition(current.status, input.status);
        if (REASON_REQUIRED.includes(input.status) && !reason) {
          throw new BadRequestError(
            `A ${input.status.toLowerCase()} order must say why — record the reason on the order`,
          );
        }
        // Placing an order for a material whose sample is still unapproved (or
        // was rejected) is a commercial risk, so it takes a deliberate override.
        if (input.status === "Ordered" && !input.force) {
          const approvals = await repository.approvalStatusByMaterial(projectId);
          const approval = approvals.get(approvalKey(current.material_name));
          if (approval === "Pending" || approval === "Rejected" || approval === "Resubmit") {
            throw new ConflictError(
              `${current.material_name} has a ${approval.toLowerCase()} material approval — resolve it or order with an override note`,
              { approvalStatus: approval },
            );
          }
        }
      }

      // A transition is the moment the thing happened: reaching Ordered dates
      // the order, reaching Delivered dates the delivery, unless the caller
      // states the real date.
      const stamps: Record<string, string | null> = {};
      const now = today();
      if (input.status === "Ordered" && current.status !== "Ordered" && !current.ordered_at && !input.orderedAt) {
        stamps["ordered_at"] = now;
      }
      if (input.status === "Delivered" && current.status !== "Delivered" && !current.delivered_at && !input.deliveredAt) {
        stamps["delivered_at"] = now;
      }
      if (input.status === "Cancelled") stamps["cancel_reason"] = reason;
      if (input.status === "Rejected") stamps["rejected_reason"] = reason;
      if (input.force && input.forceNote) {
        stamps["notes"] = [current.notes, `Ordered despite material approval: ${input.forceNote.trim()}`]
          .filter(Boolean)
          .join("\n");
      }

      const quantity = input.quantity ?? num(current.quantity);
      const rate = input.unitRate !== undefined ? input.unitRate : null;
      const repriced =
        input.unitRate !== undefined || (input.quantity !== undefined && current.unit_rate !== null);
      const effectiveRate = input.unitRate !== undefined ? rate : Number(current.unit_rate ?? 0);

      const row = await repository.updateMaterialOrder(orderId, {
        ...stamps,
        ...(input.title !== undefined ? { title: requiredText(input.title) } : {}),
        ...(input.materialName !== undefined ? { material_name: requiredText(input.materialName) } : {}),
        ...(input.quantity !== undefined ? { quantity: String(input.quantity) } : {}),
        ...(input.unit !== undefined ? { unit: requiredText(input.unit) } : {}),
        ...(input.supplierId !== undefined || input.supplier !== undefined
          ? await resolveSupplier(projectId, input.supplierId ?? current.supplier_id, input.supplier)
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.phaseId !== undefined ? { phase_id: input.phaseId } : {}),
        ...(input.activityId !== undefined ? { activity_id: input.activityId } : {}),
        ...(input.documentId !== undefined ? { document_id: input.documentId } : {}),
        ...(input.neededBy !== undefined ? { needed_by: input.neededBy } : {}),
        ...(input.orderedAt !== undefined ? { ordered_at: input.orderedAt } : {}),
        ...(input.expectedDeliveryAt !== undefined ? { expected_delivery_at: input.expectedDeliveryAt } : {}),
        ...(input.deliveredAt !== undefined ? { delivered_at: input.deliveredAt } : {}),
        ...(input.unitRate !== undefined
          ? { unit_rate: input.unitRate === null ? null : String(input.unitRate) }
          : {}),
        ...(repriced
          ? { estimated_cost: costFor(effectiveRate || null, quantity, input.estimatedCost) }
          : input.estimatedCost !== undefined
            ? { estimated_cost: money(input.estimatedCost) }
            : {}),
        ...(input.actualCost !== undefined ? { actual_cost: money(input.actualCost) } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.deliveryLocation !== undefined
          ? { delivery_location: optionalText(input.deliveryLocation) ?? null }
          : {}),
        ...(input.notes !== undefined && stamps["notes"] === undefined
          ? { notes: optionalText(input.notes) ?? null }
          : {}),
      });
      if (!row) throw new NotFoundError("Material order");
      if (row.status === "Delivered") await repository.createMaterialProcurementFromOrder(row);
      return one(row);
    },

    async deleteMaterialOrder(projectId: string, orderId: string): Promise<void> {
      await materialRow(projectId, orderId);
      await repository.deleteMaterialOrder(orderId);
    },

    /** Shared with the delivery service, which owns the goods-received event. */
    materialRow,
    hydrateMaterialOrder: one,
  };
}

export type MaterialsEquipmentService = ReturnType<typeof materialsEquipmentService>;
