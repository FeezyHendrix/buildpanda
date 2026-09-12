import type { BadgeTone } from "@/components/atoms/badge";
import type {
  PurchaseOrder,
  PurchaseOrderInput,
  PurchaseOrderStatus,
} from "@/hooks/use-purchase-orders";

export const PO_STATUSES: readonly PurchaseOrderStatus[] = [
  "Draft",
  "Issued",
  "PartiallyReceived",
  "Received",
  "Closed",
  "Cancelled",
];

export const PO_STATUS_TONE: Record<PurchaseOrderStatus, BadgeTone> = {
  Draft: "neutral",
  Issued: "info",
  PartiallyReceived: "warning",
  Received: "accent",
  Closed: "success",
  Cancelled: "danger",
};

/** A PO counts as committed spend once it has been issued to the vendor. */
export const COMMITTED_PO_STATUSES: readonly PurchaseOrderStatus[] = [
  "Issued",
  "PartiallyReceived",
  "Received",
  "Closed",
];

export const poInputClass =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10";

export interface LineItemValues {
  description: string;
  quantity: string;
  unitPrice: string;
}

export interface UpsertPurchaseOrderValues {
  poNumber: string;
  vendorName: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate: string;
  notes: string;
  stageId: string;
  items: LineItemValues[];
}

export const EMPTY_PO: UpsertPurchaseOrderValues = {
  poNumber: "",
  vendorName: "",
  status: "Draft",
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
    poNumber: values.poNumber,
    vendorName: values.vendorName,
    status: values.status,
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
    status: purchaseOrder.status,
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
