import { formatShortDate } from "@/lib/formatters";
import type { Activity, ActivityStatus } from "@/lib/project-types";
import { ACTIVITY_STATUS_LABEL } from "@/lib/project-meta";

export type ActivityStatusFilter = "all" | ActivityStatus;

const ACTIVITY_STATUSES: ActivityStatus[] = ["Planned", "InProgress", "Completed", "Cancelled"];

export const ACTIVITY_STATUS_FILTERS: { value: ActivityStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...ACTIVITY_STATUSES.map((status) => ({ value: status, label: ACTIVITY_STATUS_LABEL[status] })),
];

export interface ActivitySchedule {
  plannedDays: number;
  actualDays: number | null;
  /** Actual minus planned duration in days; null until the activity has both actual dates. */
  variance: number | null;
  openDelays: number;
  totalDelayCost: number;
  delayCurrency: string;
}

export function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.max(0, Math.round((end - start) / (24 * 3600 * 1000)));
}

export function activitySchedule(activity: Activity): ActivitySchedule {
  const plannedDays = daysBetween(activity.plannedStartAt, activity.plannedEndAt);
  const actualDays =
    activity.actualStartAt && activity.actualEndAt
      ? daysBetween(activity.actualStartAt, activity.actualEndAt)
      : null;
  return {
    plannedDays,
    actualDays,
    variance: actualDays !== null ? actualDays - plannedDays : null,
    openDelays: activity.delays.filter((d) => d.resolvedAt === null).length,
    totalDelayCost: activity.delays.reduce((sum, d) => sum + d.costImpact, 0),
    delayCurrency: activity.delays[0]?.currency ?? "NGN",
  };
}

export function formatVariance(variance: number | null): string {
  if (variance === null) return "—";
  return variance > 0 ? `+${variance} days` : `${variance} days`;
}

export function formatDate(value: string | null): string {
  return formatShortDate(value) || "—";
}

/** "01 Jan 2026 – 14 Jan 2026", or "—" when there is no start date. */
export function formatDateSpan(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function matchesActivitySearch(activity: Activity, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return [activity.name, activity.activityType, activity.phaseName, activity.location].some(
    (field) => field?.toLowerCase().includes(q),
  );
}
