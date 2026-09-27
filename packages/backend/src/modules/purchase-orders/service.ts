import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { NewPurchaseOrderItemRecord, PurchaseOrdersRepository } from "./repository.ts";
import { nextPoNumber, round2, toPurchaseOrder } from "./mappers.ts";
import {
  COMMITTED_PURCHASE_ORDER_STATUSES,
  LINES_LOCKED_STATUSES,
  type CancelPurchaseOrderInput,
  type CreatePurchaseOrderInput,
  type EditPurchaseOrderInput,
  type IssuePurchaseOrderInput,
  type MaterialOrderSource,
  type PurchaseOrder,
  type PurchaseOrderItemInput,
  type PurchaseOrderItemRow,
  type PurchaseOrderRow,
  type PurchaseOrderStatus,
  type RaiseFromMaterialOrderInput,
  type ReceivePurchaseOrderInput,
} from "./types.ts";

// Request-body shapes live in types.ts; re-exported so existing importers keep working.
export type { CreatePurchaseOrderInput, EditPurchaseOrderInput, PurchaseOrderItemInput };

export interface PurchaseOrdersDeps {
  // Wired by the route plugin from the stages module so this service never
  // touches project_phases directly.
  stageBelongsToProject?: (projectId: string, stageId: string) => Promise<boolean>;
}

function optional(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function validateItems(items: PurchaseOrderItemInput[]): void {
  if (items.length === 0) throw new BadRequestError("Purchase order requires at least one line item");
  for (const item of items) {
    if (item.description.trim().length === 0) {
      throw new BadRequestError("Line item description is required");
    }
    const quantity = item.quantity ?? 1;
    const unitPrice = item.unitPrice ?? 0;
    if (quantity <= 0) throw new BadRequestError("Line item quantity must be positive");
    if (unitPrice < 0) throw new BadRequestError("Line item unit price cannot be negative");
  }
}

function itemRecords(
  purchaseOrderId: string,
  items: PurchaseOrderItemInput[],
): NewPurchaseOrderItemRecord[] {
  return items.map((item) => ({
    id: generateId("poi"),
    purchase_order_id: purchaseOrderId,
    description: item.description.trim(),
    quantity: String(item.quantity ?? 1),
    unit_price: String(item.unitPrice ?? 0),
  }));
}

export function purchaseOrdersService(
  repository: PurchaseOrdersRepository,
  deps: PurchaseOrdersDeps = {},
) {
  // Re-read after a write so the DTO carries the joined stage name.
  async function buildPurchaseOrder(row: PurchaseOrderRow): Promise<PurchaseOrder> {
    const [withStage, items] = await Promise.all([
      repository.findById(row.id),
      repository.listItemsForPurchaseOrders([row.id]),
    ]);
    return toPurchaseOrder(withStage ?? { ...row, stage_name: null }, items);
  }

  async function resolveStageId(
    projectId: string,
    stageId: string | null | undefined,
  ): Promise<string | null> {
    const trimmed = optional(stageId ?? undefined) ?? null;
    if (!trimmed) return null;
    if (deps.stageBelongsToProject && !(await deps.stageBelongsToProject(projectId, trimmed))) {
      throw new BadRequestError("Stage does not belong to this project");
    }
    return trimmed;
  }

  async function resolveNumber(projectId: string, requested: string | null | undefined): Promise<string> {
    const trimmed = optional(requested ?? undefined) ?? null;
    const existing = await repository.listNumbers(projectId);
    if (!trimmed) return nextPoNumber(existing);
    if (existing.includes(trimmed)) {
      throw new ConflictError(`PO number ${trimmed} is already used on this project`);
    }
    return trimmed;
  }

  async function getOwnedPurchaseOrder(
    projectId: string,
    purchaseOrderId: string,
  ): Promise<PurchaseOrderRow> {
    const existing = await repository.findById(purchaseOrderId);
    if (!existing || existing.project_id !== projectId) {
      throw new NotFoundError("Purchase order");
    }
    return existing;
  }

  function assertAction(
    current: PurchaseOrderStatus,
    allowed: readonly PurchaseOrderStatus[],
    action: string,
  ): void {
    if (!allowed.includes(current)) {
      throw new ConflictError(`A ${current.toLowerCase()} purchase order cannot be ${action}`);
    }
  }

  return {
    async listByProject(projectId: string): Promise<PurchaseOrder[]> {
      const rows = await repository.listByProject(projectId);
      const itemRows = await repository.listItemsForPurchaseOrders(rows.map((row) => row.id));
      const grouped = new Map<string, PurchaseOrderItemRow[]>();
      for (const item of itemRows) {
        const bucket = grouped.get(item.purchase_order_id);
        if (bucket) bucket.push(item);
        else grouped.set(item.purchase_order_id, [item]);
      }
      return rows.map((row) => toPurchaseOrder(row, grouped.get(row.id) ?? []));
    },

    /** Committed = issued and beyond; a draft or cancelled PO commits nothing. */
    async committedTotal(projectId: string): Promise<number> {
      const orders = await this.listByProject(projectId);
      return round2(
        orders
          .filter((po) => (COMMITTED_PURCHASE_ORDER_STATUSES as readonly string[]).includes(po.status))
          .reduce((sum, po) => sum + po.total, 0),
      );
    },

    async get(projectId: string, purchaseOrderId: string): Promise<PurchaseOrder> {
      return buildPurchaseOrder(await getOwnedPurchaseOrder(projectId, purchaseOrderId));
    },

    // A PO is always born a draft: it becomes real to the vendor only when it
    // is issued, so nothing can be created already "Received".
    async create(projectId: string, input: CreatePurchaseOrderInput): Promise<PurchaseOrder> {
      validateItems(input.items);
      const id = generateId("po");
      const row = await repository.create(
        {
          id,
          project_id: projectId,
          po_number: await resolveNumber(projectId, input.poNumber),
          vendor_name: input.vendorName.trim(),
          supplier_id: optional(input.supplierId) ?? null,
          material_order_id: null,
          status: "Draft",
          order_date: optional(input.orderDate) ?? null,
          expected_date: optional(input.expectedDate) ?? null,
          notes: optional(input.notes) ?? null,
          stage_id: await resolveStageId(projectId, input.stageId),
        },
        itemRecords(id, input.items),
      );
      return buildPurchaseOrder(row);
    },

    async createFromMaterialOrder(
      projectId: string,
      order: MaterialOrderSource,
      input: RaiseFromMaterialOrderInput = {},
    ): Promise<PurchaseOrder> {
      if (!order.supplier) {
        throw new BadRequestError("Name the supplier on the material request before raising a PO");
      }
      const unitPrice = order.unitRate ?? (order.quantity > 0 ? order.estimatedCost / order.quantity : 0);
      const id = generateId("po");
      const row = await repository.create(
        {
          id,
          project_id: projectId,
          po_number: await resolveNumber(projectId, input.poNumber),
          vendor_name: order.supplier,
          supplier_id: order.supplierId,
          material_order_id: order.id,
          status: "Draft",
          order_date: today(),
          expected_date: optional(input.expectedDate) ?? order.expectedDeliveryAt ?? order.neededBy,
          notes: optional(input.notes) ?? `Raised from material request "${order.title}"`,
          stage_id: await resolveStageId(projectId, order.phaseId),
        },
        itemRecords(id, [
          {
            description: `${order.materialName} (${order.quantity} ${order.unit})`,
            quantity: order.quantity,
            unitPrice: round2(unitPrice),
          },
        ]),
      );
      return buildPurchaseOrder(row);
    },

    async edit(
      projectId: string,
      purchaseOrderId: string,
      input: EditPurchaseOrderInput,
    ): Promise<PurchaseOrder> {
      const current = await getOwnedPurchaseOrder(projectId, purchaseOrderId);
      validateItems(input.items);
      // Rewriting the lines of an order goods have already arrived against
      // would rewrite the value of what was received, unaudited.
      if ((LINES_LOCKED_STATUSES as readonly string[]).includes(current.status)) {
        throw new ConflictError(
          `PO ${current.po_number} is ${current.status.toLowerCase()} — its lines are a record of what was ordered and cannot be edited. Raise a new PO for the difference.`,
        );
      }
      const patch: Parameters<typeof repository.update>[1] = {};
      if (input.poNumber !== undefined) {
        const trimmed = input.poNumber.trim();
        if (trimmed !== current.po_number) {
          patch.po_number = await resolveNumber(projectId, trimmed);
        }
      }
      if (input.vendorName !== undefined) patch.vendor_name = input.vendorName.trim();
      if (input.supplierId !== undefined) patch.supplier_id = optional(input.supplierId) ?? null;
      if (input.orderDate !== undefined) patch.order_date = optional(input.orderDate) ?? null;
      if (input.expectedDate !== undefined) patch.expected_date = optional(input.expectedDate) ?? null;
      if (input.notes !== undefined) patch.notes = optional(input.notes) ?? null;
      if (input.stageId !== undefined) patch.stage_id = await resolveStageId(projectId, input.stageId);

      const row = await repository.update(
        purchaseOrderId,
        patch,
        itemRecords(purchaseOrderId, input.items),
      );
      if (!row) throw new NotFoundError("Purchase order");
      return buildPurchaseOrder(row);
    },

    async issue(
      projectId: string,
      purchaseOrderId: string,
      input: IssuePurchaseOrderInput,
      actorId: string,
    ): Promise<PurchaseOrder> {
      const current = await getOwnedPurchaseOrder(projectId, purchaseOrderId);
      assertAction(current.status, ["Draft"], "issued");
      const issuedAt = optional(input.issuedAt) ?? today();
      const row = await repository.transition(purchaseOrderId, {
        status: "Issued",
        issued_at: issuedAt,
        issued_by_id: actorId,
        order_date: current.order_date ?? issuedAt,
      });
      if (!row) throw new NotFoundError("Purchase order");
      return buildPurchaseOrder(row);
    },

    /**
     * Receiving is line by line against what was ordered. More than ordered is
     * a real event on site, so it is recorded and flagged rather than refused —
     * the alternative was editing the ordered quantity, which loses the fact.
     */
    async receive(
      projectId: string,
      purchaseOrderId: string,
      input: ReceivePurchaseOrderInput,
    ): Promise<PurchaseOrder> {
      const current = await getOwnedPurchaseOrder(projectId, purchaseOrderId);
      assertAction(current.status, ["Issued", "PartiallyReceived"], "received against");
      if (input.lines.length === 0) throw new BadRequestError("Record what was received on at least one line");

      const items = await repository.listItemsForPurchaseOrders([purchaseOrderId]);
      const byId = new Map(items.map((item) => [item.id, item]));
      let overReceipt = false;
      const received = input.lines.map((line) => {
        const item = byId.get(line.itemId);
        if (!item) throw new BadRequestError(`Line ${line.itemId} is not on this purchase order`);
        if (line.receivedQuantity < 0) throw new BadRequestError("Received quantity cannot be negative");
        if (line.receivedQuantity > Number(item.quantity)) overReceipt = true;
        return { itemId: line.itemId, receivedQuantity: line.receivedQuantity };
      });

      const applied = new Map(received.map((line) => [line.itemId, line.receivedQuantity]));
      const complete = items.every(
        (item) => (applied.get(item.id) ?? Number(item.received_quantity)) >= Number(item.quantity),
      );

      const row = await repository.applyReceipt(purchaseOrderId, received, {
        status: complete ? "Received" : "PartiallyReceived",
        over_receipt: overReceipt || current.over_receipt,
        ...(input.note ? { notes: [current.notes, input.note.trim()].filter(Boolean).join("\n") } : {}),
      });
      if (!row) throw new NotFoundError("Purchase order");
      return buildPurchaseOrder(row);
    },

    async cancel(
      projectId: string,
      purchaseOrderId: string,
      input: CancelPurchaseOrderInput,
    ): Promise<PurchaseOrder> {
      const current = await getOwnedPurchaseOrder(projectId, purchaseOrderId);
      assertAction(current.status, ["Draft", "Issued", "PartiallyReceived"], "cancelled");
      const reason = optional(input.reason) ?? null;
      if (!reason) throw new BadRequestError("A cancelled purchase order must say why");
      const row = await repository.transition(purchaseOrderId, {
        status: "Cancelled",
        cancel_reason: reason,
        cancelled_at: today(),
      });
      if (!row) throw new NotFoundError("Purchase order");
      return buildPurchaseOrder(row);
    },

    async close(projectId: string, purchaseOrderId: string): Promise<PurchaseOrder> {
      const current = await getOwnedPurchaseOrder(projectId, purchaseOrderId);
      assertAction(current.status, ["Received", "PartiallyReceived"], "closed");
      const row = await repository.transition(purchaseOrderId, {
        status: "Closed",
        closed_at: today(),
      });
      if (!row) throw new NotFoundError("Purchase order");
      return buildPurchaseOrder(row);
    },

    async remove(projectId: string, purchaseOrderId: string): Promise<void> {
      const current = await getOwnedPurchaseOrder(projectId, purchaseOrderId);
      if ((COMMITTED_PURCHASE_ORDER_STATUSES as readonly string[]).includes(current.status)) {
        throw new ConflictError(
          `PO ${current.po_number} has been issued — cancel it with a reason instead of deleting the record`,
        );
      }
      const deleted = await repository.deletePurchaseOrder(purchaseOrderId);
      if (deleted === 0) throw new NotFoundError("Purchase order");
    },
  };
}

export type PurchaseOrdersService = ReturnType<typeof purchaseOrdersService>;
