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

/**
 * How long a delay actually ran, as a bar on the chart.
 *
 * A delay is a stoppage of a known length, not "everything up to the activity's
 * planned end": a one-day stop is one day wide wherever it falls. The record
 * says when work resumed (`endedAt`); while it is still running the only
 * measure is the days lost so far, and a stop that has lost no days yet still
 * reads as one day so it stays visible.
 */
export function delayBarEnd(delay: ActivityDelay): Date | null {
  const started = parseDate(delay.startedAt);
  if (!started) return null;

  const ended = delay.endedAt ? parseDate(delay.endedAt) : null;
  const finish = ended && ended > started
    ? ended
    : new Date(started.getTime() + Math.max(1, delay.daysLost) * DAY_MS);

  // A stop recorded as starting and ending on the same day still cost a day;
  // a zero-width bar would simply vanish off the chart.
  return new Date(Math.max(finish.getTime(), started.getTime() + DAY_MS));
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
      const delayedEnd = delayBarEnd(delay);
      if (delayedEnd && (!projectedEnd || delayedEnd > projectedEnd)) projectedEnd = delayedEnd;
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
