import { formatShortDate } from "@/lib/formatters";
import type { BadgeTone } from "@/components/atoms/badge";
import type { MaterialOrder, MaterialOrderStatus } from "@/lib/project-types";
import { INPUT_CLASS } from "@/components/atoms/input";

export const STATUS_META: Record<MaterialOrderStatus, { label: string; tone: BadgeTone }> = {
  Draft: { label: "Draft", tone: "neutral" },
  Requested: { label: "Requested", tone: "info" },
  Approved: { label: "Approved", tone: "success" },
  Ordered: { label: "Ordered", tone: "warning" },
  PartiallyDelivered: { label: "Partially delivered", tone: "warning" },
  Delivered: { label: "Delivered", tone: "success" },
  Cancelled: { label: "Cancelled", tone: "danger" },
  Rejected: { label: "Rejected", tone: "danger" },
};

export const STATUS_FILTERS: Array<MaterialOrderStatus | "all"> = [
  "all",
  "Requested",
  "Approved",
  "Ordered",
  "PartiallyDelivered",
  "Delivered",
];

export const STATUS_FILTER_ITEMS = STATUS_FILTERS.map((status) => ({
  value: status,
  label: status === "all" ? "All" : STATUS_META[status].label,
}));

export const FIELD = INPUT_CLASS;

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nextWeek(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function formatDate(value: string | null): string {
  return formatShortDate(value) || "Not set";
}

export function nextStatus(status: MaterialOrderStatus): MaterialOrderStatus | null {
  switch (status) {
    case "Draft":
      return "Requested";
    case "Requested":
      return "Approved";
    case "Approved":
      return "Ordered";
    case "Ordered":
      return "PartiallyDelivered";
    case "PartiallyDelivered":
      return "Delivered";
    case "Delivered":
    case "Cancelled":
    case "Rejected":
      return null;
  }
}

/**
 * The supplier register won: a linked supplier names itself, and the free-text
 * column is only the fallback for rows typed before the register existed.
 */
export function supplierLabel(order: MaterialOrder): string | null {
  return order.supplierName ?? order.supplier;
}

export type LateFilter = "all" | "late";

export const LATE_FILTER_OPTIONS: readonly { value: LateFilter; label: string }[] = [
  { value: "all", label: "All orders" },
  { value: "late", label: "Late only" },
] as const;

export const ALL_SUPPLIERS = "__all__";

/** Every supplier that actually appears on an order, for the filter dropdown. */
export function supplierOptions(orders: readonly MaterialOrder[]): { value: string; label: string }[] {
  const names = new Set<string>();
  for (const order of orders) {
    const name = supplierLabel(order);
    if (name) names.add(name);
  }
  return [
    { value: ALL_SUPPLIERS, label: "All suppliers" },
    ...[...names].sort((a, b) => a.localeCompare(b)).map((name) => ({ value: name, label: name })),
  ];
}

export function matchesOrderSearch(order: MaterialOrder, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [order.materialName, order.title, supplierLabel(order)].some((field) =>
    field?.toLowerCase().includes(q),
  );
}

/** "84 of 120 delivered", or the outstanding balance when some is still owed. */
export function deliveryProgress(order: MaterialOrder): string {
  const delivered = order.deliveredQuantity ?? 0;
  const outstanding = order.outstandingQuantity ?? Math.max(0, order.quantity - delivered);
  if (delivered === 0) return outstanding > 0 ? `${formatQty(outstanding)} outstanding` : "Nothing delivered";
  if (outstanding <= 0) return "Fully delivered";
  return `${formatQty(delivered)} of ${formatQty(order.quantity)} delivered`;
}

export function formatQty(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

