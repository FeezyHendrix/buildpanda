import {
  COMMITTED_PURCHASE_ORDER_STATUSES,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type PurchaseOrderItemRow,
  type PurchaseOrderRowWithStage,
} from "./types.ts";

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function num(value: string): number {
  return Number(value);
}

/** PO-1, PO-2, … per project: the sequence a QS expects, not a free-text box. */
export function nextPoNumber(existing: string[]): string {
  let highest = 0;
  for (const number of existing) {
    const match = /^PO-(\d+)$/.exec(number.trim());
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `PO-${highest + 1}`;
}

function toItem(row: PurchaseOrderItemRow): PurchaseOrderItem {
  const quantity = num(row.quantity);
  const unitPrice = num(row.unit_price);
  const receivedQuantity = num(row.received_quantity ?? "0");
  return {
    id: row.id,
    description: row.description,
    quantity,
    unitPrice,
    lineTotal: round2(quantity * unitPrice),
    receivedQuantity,
    outstandingQuantity: round2(Math.max(0, quantity - receivedQuantity)),
    overReceived: receivedQuantity > quantity,
  };
}

export function toPurchaseOrder(
  row: PurchaseOrderRowWithStage,
  itemRows: PurchaseOrderItemRow[],
): PurchaseOrder {
  const items = itemRows.map(toItem);
  const total = round2(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const receivedTotal = round2(
    items.reduce((sum, item) => sum + item.receivedQuantity * item.unitPrice, 0),
  );
  return {
    id: row.id,
    poNumber: row.po_number,
    vendorName: row.vendor_name,
    supplierId: row.supplier_id ?? null,
    materialOrderId: row.material_order_id ?? null,
    status: row.status,
    orderDate: row.order_date,
    expectedDate: row.expected_date,
    issuedAt: row.issued_at ?? null,
    issuedById: row.issued_by_id ?? null,
    cancelReason: row.cancel_reason ?? null,
    cancelledAt: row.cancelled_at ?? null,
    closedAt: row.closed_at ?? null,
    overReceipt: Boolean(row.over_receipt),
    committed: (COMMITTED_PURCHASE_ORDER_STATUSES as readonly string[]).includes(row.status),
    notes: row.notes,
    stageId: row.stage_id ?? null,
    stageName: row.stage_name ?? null,
    total,
    receivedTotal,
    items,
  };
}
