import type { Activity, KeyDate, Stage } from "@/lib/project-types";
import type { ILink } from "@svar-ui/react-gantt";
import { computeCriticalActivityIds } from "./schedule-critical-path";
import { DAY_MS, delayEnd, delaySummary, parseDate } from "./schedule-utils";

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
  critical?: boolean;
  color?: string;
}

interface TimelinePhase {
  id: string;
  name: string;
}

interface DateRange {
  min: number;
  max: number;
}

const ROOT_PARENT = 0;
const CRITICAL_COLOR = "#C72525";

function addRange(range: DateRange, start: Date, end: Date): void {
  range.min = Math.min(range.min, start.getTime());
  range.max = Math.max(range.max, end.getTime());
}

function canRenderActivity(activity: Activity): boolean {
  const start = parseDate(activity.plannedStartAt);
  const end = parseDate(activity.plannedEndAt);
  return Boolean(start && (activity.isMilestone || end));
}

function stageRows(stages: Stage[], usedPhaseIds: Set<string>, range: DateRange): GanttTask[] {
  const rows: GanttTask[] = [];

  for (const stage of stages) {
    const start = stage.startDate ? parseDate(stage.startDate) : null;
    const end = stage.endDate ? parseDate(stage.endDate) : start;
    if (!start || !end) continue;
    const hasChildActivity = usedPhaseIds.has(stage.id);
    usedPhaseIds.add(stage.id);

    rows.push({
      id: stage.id,
      text: stage.name,
      type: hasChildActivity ? "summary" : "task",
      parent: ROOT_PARENT,
      open: hasChildActivity ? true : undefined,
      start,
      end,
      progress: Math.round(stage.progressPercent),
    });
    addRange(range, start, end);
  }

  return rows;
}

function keyDateRows(keyDates: KeyDate[], range: DateRange): GanttTask[] {
  const rows: GanttTask[] = [];

  for (const keyDate of keyDates) {
    const date = parseDate(keyDate.actualDate ?? keyDate.targetDate ?? "");
    if (!date) continue;
    rows.push({
      id: `keydate:${keyDate.id}`,
      text: `${keyDate.label} (${keyDate.status})`,
      type: "milestone",
      parent: ROOT_PARENT,
      start: date,
      end: date,
      progress: keyDate.status === "Met" ? 100 : 0,
    });
    addRange(range, date, date);
  }

  return rows;
}

function activityRows(activities: Activity[], usedPhaseIds: ReadonlySet<string>, range: DateRange): GanttTask[] {
  const activitiesById = new Map(activities.map((activity) => [activity.id, activity]));
  const parentActivityIds = new Set(activities.flatMap((activity) => activity.parentActivityId ? [activity.parentActivityId] : []));
  const rows: GanttTask[] = [];

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
    const taskEnd = activity.isMilestone ? start : end;
    if (!taskEnd) continue;

    const isSummary = activity.isSummary && parentActivityIds.has(activity.id);
    rows.push({
      id: activity.id,
      text: activity.isDelayed ? `${activity.name} · delayed` : activity.name,
      type: isSummary ? "summary" : activity.isMilestone ? "milestone" : "task",
      parent,
      open: isSummary ? true : undefined,
      start,
      end: taskEnd,
      progress: Math.round(activity.percentComplete),
      base_start,
      base_end,
    });
    addRange(range, start, end ?? start);

    for (const delay of activity.delays) {
      const delayStart = parseDate(delay.startedAt);
      if (!delayStart) continue;
      const extendedEnd = delayEnd(delay, end ?? start);
      rows.push({
        id: `${activity.id}-${delay.id}`,
        text: `Delay: ${delay.reasonName}`,
        type: "task",
        parent,
        start: delayStart,
        end: extendedEnd,
        progress: delay.resolvedAt ? 100 : 10,
      });
      addRange(range, delayStart, extendedEnd);
    }
  }

  return rows;
}

function linkRows(activities: Activity[], emittedIds: ReadonlySet<string>): ILink[] {
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
      if (emittedIds.has(pred.activityId) && emittedIds.has(activity.id)) {
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

  return links;
}

function reparentMissingParents(rows: GanttTask[], emittedIds: ReadonlySet<string>): void {
  for (const row of rows) {
    if (row.parent !== ROOT_PARENT && !emittedIds.has(String(row.parent))) {
      row.parent = ROOT_PARENT;
    }
  }
}

function markCriticalRows(rows: GanttTask[], criticalIds: ReadonlySet<string>): void {
  for (const row of rows) {
    const id = String(row.id);
    if (!criticalIds.has(id)) continue;
    row.critical = true;
    row.color = CRITICAL_COLOR;
    row.text = `Critical · ${row.text}`;
  }
}

export function buildGanttData(
  activities: Activity[],
  timeline: TimelinePhase[],
  stages: Stage[] = [],
  keyDates: KeyDate[] = [],
) {
  const phaseById = new Map(timeline.map((phase) => [phase.id, phase]));
  const stagesById = new Map(stages.map((stage) => [stage.id, stage]));
  const usedPhaseIds = new Set<string>();
  const range: DateRange = {
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
  };

  const renderableActivities = activities.filter(canRenderActivity);
  for (const activity of renderableActivities) {
    if (activity.phaseId && (phaseById.has(activity.phaseId) || stagesById.has(activity.phaseId))) {
      usedPhaseIds.add(activity.phaseId);
    }
  }

  const summaryRows = stageRows(stages, usedPhaseIds, range);
  for (const phaseId of usedPhaseIds) {
    if (stagesById.has(phaseId)) continue;
    const phase = phaseById.get(phaseId);
    if (!phase) continue;
    summaryRows.push({ id: phase.id, text: phase.name, type: "summary", parent: ROOT_PARENT, open: true });
  }

  const taskRows = [...activityRows(renderableActivities, usedPhaseIds, range), ...keyDateRows(keyDates, range)];
  const emittedIds = new Set<string>([
    ...summaryRows.map((row) => String(row.id)),
    ...taskRows.map((row) => String(row.id)),
  ]);
  reparentMissingParents(taskRows, emittedIds);

  const criticalIds = computeCriticalActivityIds(renderableActivities, emittedIds);
  markCriticalRows(taskRows, criticalIds);

  const hasRange = Number.isFinite(range.min) && Number.isFinite(range.max);

  return {
    tasks: [...summaryRows, ...taskRows],
    links: linkRows(renderableActivities, emittedIds),
    rangeStart: hasRange ? new Date(range.min - 7 * DAY_MS) : undefined,
    rangeEnd: hasRange ? new Date(range.max + 7 * DAY_MS) : undefined,
    delays: delaySummary(activities),
    criticalCount: criticalIds.size,
  };
}
