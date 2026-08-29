import type { Activity, ActivityDelay } from "@/lib/project-types";

export interface DelaySummary {
  open: number;
  total: number;
  cost: number;
}

export interface ScheduleReport {
  milestoneCount: number;
  milestoneCost: number;
  activityCount: number;
  completedActivities: number;
  delayedActivities: number;
  dailyLogCount: number;
  delayCount: number;
  openDelayCount: number;
  delayCost: number;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  projectedEnd: Date | null;
}

export interface GanttScale {
  unit: "month" | "week";
  step: number;
  format: (date: Date) => string;
}

export const SCALES: GanttScale[] = [
  {
    unit: "month",
    step: 1,
    format: (date) =>
      date.toLocaleString("en-US", { month: "long", year: "numeric" }),
  },
  {
    unit: "week",
    step: 1,
    format: (date) =>
      date.toLocaleString("en-US", { month: "short", day: "numeric" }),
  },
];

export const DAY_MS = 24 * 60 * 60 * 1000;
export const GANTT_ZOOM = { minCellWidth: 30, maxCellWidth: 240 } as const;

export function parseDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function delayEnd(delay: ActivityDelay, activityEnd: Date): Date {
  const resolved = delay.resolvedAt ? parseDate(delay.resolvedAt) : null;
  if (resolved) return resolved;

  const started = parseDate(delay.startedAt) ?? activityEnd;
  const today = new Date();
  return new Date(Math.max(activityEnd.getTime(), started.getTime() + DAY_MS, today.getTime()));
}

export function delaySummary(activities: Activity[]): DelaySummary {
  return activities.reduce<DelaySummary>(
    (summary, activity) => {
      for (const delay of activity.delays) {
        summary.total += 1;
        summary.cost += delay.costImpact;
        if (delay.resolvedAt === null) summary.open += 1;
      }
      return summary;
    },
    { open: 0, total: 0, cost: 0 },
  );
}

export function buildReport(
  activities: Activity[],
  milestoneCost: number,
  milestoneCount: number,
  dailyLogCount: number,
): ScheduleReport {
  let plannedStart: Date | null = null;
  let plannedEnd: Date | null = null;
  let projectedEnd: Date | null = null;
  let delayCount = 0;
  let openDelayCount = 0;
  let delayCost = 0;

  for (const activity of activities) {
    const start = parseDate(activity.plannedStartAt);
    const end = parseDate(activity.plannedEndAt);
    if (start && (!plannedStart || start < plannedStart)) plannedStart = start;
    if (end && (!plannedEnd || end > plannedEnd)) plannedEnd = end;
    if (end && (!projectedEnd || end > projectedEnd)) projectedEnd = end;

    for (const delay of activity.delays) {
      delayCount += 1;
      delayCost += delay.costImpact;
      if (delay.resolvedAt === null) openDelayCount += 1;
      if (end) {
        const delayedEnd = delayEnd(delay, end);
        if (!projectedEnd || delayedEnd > projectedEnd) projectedEnd = delayedEnd;
      }
    }
  }

  return {
    milestoneCount,
    milestoneCost,
    activityCount: activities.length,
    completedActivities: activities.filter((activity) => activity.status === "Completed").length,
    delayedActivities: activities.filter((activity) => activity.isDelayed).length,
    dailyLogCount,
    delayCount,
    openDelayCount,
    delayCost,
    plannedStart,
    plannedEnd,
    projectedEnd,
  };
}

export function formatDate(date: Date | null): string {
  if (!date) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
