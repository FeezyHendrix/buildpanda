import { formatShortDate } from "@/lib/formatters";
import type { BadgeTone } from "@/components/atoms/badge";
import type {
  EquipmentBucket,
  EquipmentRequest,
  EquipmentRequestStatus,
} from "@/lib/project-types";

/**
 * Plant hire lifecycle. The bucket is the server-side stage filter the page has
 * always used (it drives the route and the list query); the status is the value
 * stored on the record. A bucket groups several statuses, so the tabs stay the
 * stage ladder and the badge keeps saying exactly where the record is.
 */
export const EQUIPMENT_BUCKETS: Array<{
  bucket: EquipmentBucket;
  label: string;
  helper: string;
}> = [
  { bucket: "requests", label: "Requests", helper: "New rental needs" },
  { bucket: "approvals", label: "Approvals", helper: "Awaiting go-ahead" },
  { bucket: "schedule", label: "Schedule", helper: "Approved to book" },
  { bucket: "on-hire", label: "On hire", helper: "Mobilized to site" },
  { bucket: "returns", label: "Returns", helper: "Closed or cancelled" },
];

export const EQUIPMENT_BUCKET_TABS = EQUIPMENT_BUCKETS.map((item) => ({
  value: item.bucket,
  label: item.label,
}));

export const DEFAULT_EQUIPMENT_BUCKET = EQUIPMENT_BUCKETS[0]!;

export const EQUIPMENT_STATUS_META: Record<
  EquipmentRequestStatus,
  { label: string; tone: BadgeTone }
> = {
  Draft: { label: "Draft", tone: "neutral" },
  Requested: { label: "Requested", tone: "info" },
  Approved: { label: "Approved", tone: "success" },
  Scheduled: { label: "Scheduled", tone: "warning" },
  OnHire: { label: "On hire", tone: "warning" },
  Returned: { label: "Returned", tone: "success" },
  Cancelled: { label: "Cancelled", tone: "danger" },
};

/** The stage the record moves to next, or null once it is closed. */
export function nextEquipmentStatus(
  status: EquipmentRequestStatus,
): EquipmentRequestStatus | null {
  switch (status) {
    case "Draft":
      return "Requested";
    case "Requested":
      return "Approved";
    case "Approved":
      return "Scheduled";
    case "Scheduled":
      return "OnHire";
    case "OnHire":
      return "Returned";
    case "Returned":
    case "Cancelled":
      return null;
  }
}

/** Transitions from Approved onward mirror the backend's approval guard. */
const APPROVAL_TIER: EquipmentRequestStatus[] = ["Approved", "Scheduled", "OnHire", "Returned"];

export function canAdvanceTo(
  next: EquipmentRequestStatus,
  canRequest: boolean,
  canApprove: boolean,
): boolean {
  return APPROVAL_TIER.includes(next) ? canApprove : canRequest;
}

export function formatEquipmentDate(value: string | null): string {
  return formatShortDate(value) || "—";
}

/** "01 Jan 2026 – 14 Jan 2026", or "—" when neither end is set. */
export function formatEquipmentSpan(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  return `${formatEquipmentDate(start)} – ${formatEquipmentDate(end)}`;
}

/** The supplier as recorded: the register name wins over the free-text one. */
export function equipmentSupplier(request: EquipmentRequest): string | null {
  return request.supplierName ?? request.supplier;
}

/** Supplier, then the phase/activity the hire is booked against. */
export function equipmentSubLine(request: EquipmentRequest): string {
  return [equipmentSupplier(request), request.phaseName, request.activityName]
    .filter(Boolean)
    .join(" · ");
}

export function matchesEquipmentSearch(request: EquipmentRequest, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return [
    request.equipmentName,
    request.equipmentType,
    request.title,
    request.plantRef,
    equipmentSupplier(request),
  ].some((field) => field?.toLowerCase().includes(q));
}
