import type { BadgeTone } from "@/components/atoms/badge";
import type {
  PurchaseOrder,
  PurchaseOrderInput,
  PurchaseOrderStatus,
} from "@/hooks/use-purchase-orders";

/**
 * The status is never typed. A PO is born Draft and moves only through the four
 * actions the server exposes, so this map is for reading a status, not setting
 * one — and the labels are spaced properly rather than "PartiallyReceived".
 */
export const PO_STATUS_META: Record<PurchaseOrderStatus, { label: string; tone: BadgeTone }> = {
  Draft: { label: "Draft", tone: "neutral" },
  Issued: { label: "Issued", tone: "info" },
  PartiallyReceived: { label: "Partially received", tone: "warning" },
  Received: { label: "Received", tone: "accent" },
  Closed: { label: "Closed", tone: "success" },
  Cancelled: { label: "Cancelled", tone: "danger" },
};

export type PurchaseOrderAction = "issue" | "receive" | "cancel" | "close";

const ACTIONS: Record<PurchaseOrderStatus, readonly PurchaseOrderAction[]> = {
  Draft: ["issue", "cancel"],
  Issued: ["receive", "cancel"],
  PartiallyReceived: ["receive", "cancel"],
  Received: ["close"],
  Closed: [],
  Cancelled: [],
};

export const PO_ACTION_LABEL: Record<PurchaseOrderAction, string> = {
  issue: "Issue to vendor",
  receive: "Receive goods",
  cancel: "Cancel",
  close: "Close",
};

/** What the server will actually accept next, so the UI offers nothing else. */
export function availableActions(status: PurchaseOrderStatus): readonly PurchaseOrderAction[] {
  return ACTIONS[status];
}

/** A received PO's lines are read-only — the server 409s on an edit. */
export function canEditLines(status: PurchaseOrderStatus): boolean {
  return status === "Draft" || status === "Issued" || status === "PartiallyReceived";
}

/** Only an untouched draft can be deleted; anything issued is cancelled instead. */
export function canDeletePurchaseOrder(status: PurchaseOrderStatus): boolean {
  return status === "Draft";
}

export interface LineItemValues {
  description: string;
  quantity: string;
  unitPrice: string;
}

export interface UpsertPurchaseOrderValues {
  poNumber: string;
  vendorName: string;
  supplierId: string | null;
  orderDate: string;
  expectedDate: string;
  notes: string;
  stageId: string;
  items: LineItemValues[];
}

export const EMPTY_PO: UpsertPurchaseOrderValues = {
  poNumber: "",
  vendorName: "",
  supplierId: null,
  orderDate: "",
  expectedDate: "",
  notes: "",
  stageId: "",
  items: [{ description: "", quantity: "1", unitPrice: "" }],
};

export function lineTotal(item: LineItemValues): number {
  const quantity = Number(item.quantity || "0");
  const unitPrice = Number(item.unitPrice || "0");
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return 0;
  return Math.round(quantity * unitPrice * 100) / 100;
}

export function isLineValid(item: LineItemValues): boolean {
  const quantity = Number(item.quantity || "0");
  const unitPrice = Number(item.unitPrice || "0");
  return (
    item.description.trim().length > 0 &&
    Number.isFinite(quantity) &&
    quantity > 0 &&
    Number.isFinite(unitPrice) &&
    unitPrice >= 0
  );
}

export function toInput(values: UpsertPurchaseOrderValues): PurchaseOrderInput {
  return {
    // Left blank the server sequences it as PO-<n> for this project.
    poNumber: values.poNumber.trim() || undefined,
    vendorName: values.vendorName,
    supplierId: values.supplierId,
    orderDate: values.orderDate || undefined,
    expectedDate: values.expectedDate || undefined,
    notes: values.notes || undefined,
    stageId: values.stageId || null,
    items: values.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity || "1"),
      unitPrice: Number(item.unitPrice || "0"),
    })),
  };
}

export function toValues(purchaseOrder: PurchaseOrder): UpsertPurchaseOrderValues {
  return {
    poNumber: purchaseOrder.poNumber,
    vendorName: purchaseOrder.vendorName,
    supplierId: purchaseOrder.supplierId,
    orderDate: purchaseOrder.orderDate ?? "",
    expectedDate: purchaseOrder.expectedDate ?? "",
    notes: purchaseOrder.notes ?? "",
    stageId: purchaseOrder.stageId ?? "",
    items: purchaseOrder.items.map((item) => ({
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
    })),
  };
}

/**
 * The committed figure is the server's: each PO carries the flag, so the page
 * sums what the API already decided rather than re-deriving the rule.
 */
export function committedTotal(purchaseOrders: readonly PurchaseOrder[]): number {
  return purchaseOrders.reduce(
    (sum, purchaseOrder) => (purchaseOrder.committed ? sum + purchaseOrder.total : sum),
    0,
  );
}

export function receivedTotal(purchaseOrders: readonly PurchaseOrder[]): number {
  return purchaseOrders.reduce((sum, purchaseOrder) => sum + purchaseOrder.receivedTotal, 0);
}
