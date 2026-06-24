import { formatShortDate } from "@/lib/formatters";
import type { MaterialOrderStatus } from "@/lib/project-types";

export const STATUS_META: Record<MaterialOrderStatus, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  Draft: { label: "Draft", tone: "neutral" },
  Requested: { label: "Requested", tone: "info" },
  Approved: { label: "Approved", tone: "success" },
  Ordered: { label: "Ordered", tone: "warning" },
  PartiallyDelivered: { label: "Partially delivered", tone: "warning" },
  Delivered: { label: "Delivered", tone: "success" },
  Cancelled: { label: "Cancelled", tone: "danger" },
};

export const STATUS_FILTERS: Array<MaterialOrderStatus | "all"> = [
  "all",
  "Requested",
  "Approved",
  "Ordered",
  "PartiallyDelivered",
  "Delivered",
];

export const FIELD = "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

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
      return null;
  }
}

