import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type {
  NewPurchaseOrderItemRecord,
  PurchaseOrdersRepository,
} from "./repository.ts";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderItemRow,
  PurchaseOrderRow,
  PurchaseOrderStatus,
} from "./types.ts";

export interface PurchaseOrderItemInput {
  description: string;
  quantity?: number;
  unitPrice?: number;
}

export interface CreatePurchaseOrderInput {
  poNumber: string;
  vendorName: string;
  status?: PurchaseOrderStatus;
  orderDate?: string;
  expectedDate?: string;
  notes?: string;
  items: PurchaseOrderItemInput[];
}

export interface EditPurchaseOrderInput {
  poNumber?: string;
  vendorName?: string;
  status?: PurchaseOrderStatus;
  orderDate?: string;
  expectedDate?: string;
  notes?: string;
  items: PurchaseOrderItemInput[];
}

function num(value: string): number {
  return Number(value);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function optional(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toItem(row: PurchaseOrderItemRow): PurchaseOrderItem {
  const quantity = num(row.quantity);
  const unitPrice = num(row.unit_price);
  return {
    id: row.id,
    description: row.description,
    quantity,
    unitPrice,
    lineTotal: round2(quantity * unitPrice),
  };
}

function toPurchaseOrder(
  row: PurchaseOrderRow,
  itemRows: PurchaseOrderItemRow[],
): PurchaseOrder {
  const items = itemRows.map(toItem);
  const total = round2(items.reduce((sum, item) => sum + item.lineTotal, 0));
  return {
    id: row.id,
    poNumber: row.po_number,
    vendorName: row.vendor_name,
    status: row.status,
    orderDate: row.order_date,
    expectedDate: row.expected_date,
    notes: row.notes,
    total,
    items,
  };
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

export function purchaseOrdersService(repository: PurchaseOrdersRepository) {
  async function buildPurchaseOrder(row: PurchaseOrderRow): Promise<PurchaseOrder> {
    const items = await repository.listItemsForPurchaseOrders([row.id]);
    return toPurchaseOrder(row, items);
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

    async create(projectId: string, input: CreatePurchaseOrderInput): Promise<PurchaseOrder> {
      validateItems(input.items);
      const id = generateId("po");
      const row = await repository.create(
        {
          id,
          project_id: projectId,
          po_number: input.poNumber.trim(),
          vendor_name: input.vendorName.trim(),
          status: input.status ?? "Draft",
          order_date: optional(input.orderDate) ?? null,
          expected_date: optional(input.expectedDate) ?? null,
          notes: optional(input.notes) ?? null,
        },
        itemRecords(id, input.items),
      );
      return buildPurchaseOrder(row);
    },

    async edit(
      projectId: string,
      purchaseOrderId: string,
      input: EditPurchaseOrderInput,
    ): Promise<PurchaseOrder> {
      await getOwnedPurchaseOrder(projectId, purchaseOrderId);
      validateItems(input.items);
      const patch: Parameters<typeof repository.update>[1] = {};
      if (input.poNumber !== undefined) patch.po_number = input.poNumber.trim();
      if (input.vendorName !== undefined) patch.vendor_name = input.vendorName.trim();
      if (input.status !== undefined) patch.status = input.status;
      if (input.orderDate !== undefined) patch.order_date = optional(input.orderDate) ?? null;
      if (input.expectedDate !== undefined) patch.expected_date = optional(input.expectedDate) ?? null;
      if (input.notes !== undefined) patch.notes = optional(input.notes) ?? null;

      const row = await repository.update(
        purchaseOrderId,
        patch,
        itemRecords(purchaseOrderId, input.items),
      );
      if (!row) throw new NotFoundError("Purchase order");
      return buildPurchaseOrder(row);
    },

    async remove(projectId: string, purchaseOrderId: string): Promise<void> {
      await getOwnedPurchaseOrder(projectId, purchaseOrderId);
      const deleted = await repository.deletePurchaseOrder(purchaseOrderId);
      if (deleted === 0) throw new NotFoundError("Purchase order");
    },
  };
}
