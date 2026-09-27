import type { BadgeTone } from "@/components/atoms/badge";
import type {
  InspectionOutcome,
  InspectionReport,
  RequesterSide,
  ServiceStatus,
} from "@/lib/project-types";
import { SERVICE_STATUSES } from "@/lib/project-types";

export type ServiceStatusFilter = ServiceStatus | "all";

/**
 * The lifecycle of a service order, in one place. Each value carries a shape as
 * well as a tone — a status must never be readable by colour alone.
 */
export const SERVICE_STATUS_META: Record<
  ServiceStatus,
  { label: string; tone: BadgeTone; mark: string; blurb: string }
> = {
  Requested: {
    label: "Requested",
    tone: "info",
    mark: "◷",
    blurb: "Waiting for BuildPanda to assign an inspector.",
  },
  Scheduled: {
    label: "Scheduled",
    tone: "warning",
    mark: "◆",
    blurb: "An inspector is assigned and the visit is booked.",
  },
  Attended: {
    label: "Attended",
    tone: "accent",
    mark: "◑",
    blurb: "The inspector attended site; the report is not issued yet.",
  },
  Reported: {
    label: "Reported",
    tone: "success",
    mark: "●",
    blurb: "The report has been issued.",
  },
  Cancelled: {
    label: "Cancelled",
    tone: "neutral",
    mark: "✕",
    blurb: "The service order was called off.",
  },
};

export const OUTCOME_META: Record<
  InspectionOutcome,
  { label: string; tone: BadgeTone; mark: string }
> = {
  pass: { label: "Passed", tone: "success", mark: "✓" },
  fail: { label: "Failed", tone: "danger", mark: "✕" },
};

export const REQUESTER_SIDE_LABEL: Record<RequesterSide, string> = {
  client: "Client side",
  contractor: "Contractor side",
};

export const SERVICE_STATUS_TABS: { value: ServiceStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...SERVICE_STATUSES.map((status) => ({
    value: status as ServiceStatusFilter,
    label: SERVICE_STATUS_META[status].label,
  })),
];

/** Title, category, contractor, location and inspector are all scannable. */
export function matchesInspectionSearch(report: InspectionReport, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  return [
    report.title,
    report.category,
    report.contractorName,
    report.location,
    report.inspectorUserId ? report.inspector.name : null,
  ].some((field) => field?.toLowerCase().includes(needle));
}

/**
 * Only the BuildPanda inspector put on the job may record what was found.
 * Platform staff stand in for an inspector who cannot — everyone else, the
 * contractor included, reads the report and never writes it.
 */
export function isAssignedInspector(
  report: InspectionReport,
  userId: string | undefined,
  isPlatformAdmin: boolean,
): boolean {
  if (isPlatformAdmin) return true;
  return Boolean(report.inspectorUserId && userId && report.inspectorUserId === userId);
}

/** The requester may call their own order off, until the report is issued. */
export function canCancelInspection(
  report: InspectionReport,
  userId: string | undefined,
  isPlatformAdmin: boolean,
): boolean {
  if (report.serviceStatus === "Reported" || report.serviceStatus === "Cancelled") return false;
  if (isPlatformAdmin) return true;
  return Boolean(report.requestedById && userId && report.requestedById === userId);
}
