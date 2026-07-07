import type { Activity, ActivityDelay } from "@/lib/project-types";
import type { ILink } from "@svar-ui/react-gantt";

export interface GanttTask {
  id: string | number;
  text: string;
  type: "summary" | "task" | "milestone";
  parent: string | number;
  open?: boolean;
  start?: Date;
  end?: Date;
  progress?: number;
  base_start?: Date;
  base_end?: Date;
}

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

export const ROOT_PARENT = 0;
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

export function buildGanttData(
  activities: Activity[],
  timeline: { id: string; name: string }[]
) {
  const phaseById = new Map(timeline.map((phase) => [phase.id, phase]));
  const activitiesById = new Map(activities.map((activity) => [activity.id, activity]));

  const usedPhaseIds = new Set<string>();
  const validTaskIds = new Set<string>();

  for (const activity of activities) {
    validTaskIds.add(activity.id);
    if (activity.phaseId && phaseById.has(activity.phaseId)) {
      usedPhaseIds.add(activity.phaseId);
    }
  }

  const summaryRows: GanttTask[] = [];
  for (const phaseId of usedPhaseIds) {
    const phase = phaseById.get(phaseId)!;
    summaryRows.push({
      id: phase.id,
      text: phase.name,
      type: "summary",
      parent: ROOT_PARENT,
      open: true,
    });
  }

  const taskRows: GanttTask[] = [];
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const activity of activities) {
    const start = parseDate(activity.plannedStartAt);
    const end = parseDate(activity.plannedEndAt);
    if (!start) continue;
    if (!activity.isMilestone && !end) continue;

    const parentActivity = activity.parentActivityId ? activitiesById.get(activity.parentActivityId) : undefined;
    const parent = parentActivity
      ? parentActivity.id
      : activity.phaseId && usedPhaseIds.has(activity.phaseId)
        ? activity.phaseId
        : ROOT_PARENT;

    const base_start = activity.baselineStartAt ? parseDate(activity.baselineStartAt) ?? undefined : undefined;
    const base_end = activity.baselineEndAt ? parseDate(activity.baselineEndAt) ?? undefined : undefined;

    taskRows.push({
      id: activity.id,
      text: activity.isDelayed ? `${activity.name} · delayed` : activity.name,
      type: activity.isSummary ? "summary" : activity.isMilestone ? "milestone" : "task",
      parent,
      open: activity.isSummary ? true : undefined,
      start,
      end: activity.isMilestone ? start : end!,
      progress: Math.round(activity.percentComplete),
      base_start,
      base_end,
    });

    min = Math.min(min, start.getTime());
    if (end) max = Math.max(max, end.getTime());

    for (const delay of activity.delays) {
      const delayStart = parseDate(delay.startedAt);
      if (!delayStart) continue;
      const extendedEnd = delayEnd(delay, end ?? start);
      taskRows.push({
        id: `${activity.id}-${delay.id}`,
        text: `Delay: ${delay.reasonName}`,
        type: "task",
        parent,
        start: delayStart,
        end: extendedEnd,
        progress: delay.resolvedAt ? 100 : 10,
      });
      min = Math.min(min, delayStart.getTime());
      max = Math.max(max, extendedEnd.getTime());
    }
  }

  const links: ILink[] = [];
  let linkIdCounter = 1;
  const linkTypeMap: Record<string, "e2s" | "s2s" | "e2e" | "s2e"> = {
    FS: "e2s",
    SS: "s2s",
    FF: "e2e",
    SF: "s2e",
  };

  for (const activity of activities) {
    for (const pred of activity.predecessors) {
      if (validTaskIds.has(pred.activityId)) {
        links.push({
          id: String(linkIdCounter++),
          source: pred.activityId,
          target: activity.id,
          type: linkTypeMap[pred.type] ?? "e2s",
          lag: pred.lagDays,
        });
      }
    }
  }

  const hasRange = Number.isFinite(min) && Number.isFinite(max);

  return {
    tasks: [...summaryRows, ...taskRows],
    links,
    rangeStart: hasRange ? new Date(min - 7 * DAY_MS) : undefined,
    rangeEnd: hasRange ? new Date(max + 7 * DAY_MS) : undefined,
    delays: delaySummary(activities),
  };
}
