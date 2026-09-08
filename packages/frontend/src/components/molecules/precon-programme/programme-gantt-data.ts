import type { ILink } from "@svar-ui/react-gantt";
import type { PreconProgrammeTask, ProgrammeDependency } from "@/api/precon";

// Pure mapping from the server's scheduled programme to the Gantt's rows and
// links. Dates already come from the scheduler, so nothing here computes them;
// the chart is a second view of the same tasks the table shows.

export interface ProgrammeGanttTask {
  id: string;
  text: string;
  type: "summary" | "task" | "milestone";
  parent: string | number;
  open?: boolean;
  start: Date;
  end: Date;
  progress?: number;
  critical?: boolean;
  color?: string;
  /** Working days, as the table and the scheduler count them. */
  durationDays: number;
  isMilestone: boolean;
}

const ROOT = 0;
const DAY_MS = 24 * 60 * 60 * 1000;
const CRITICAL_COLOR = "#C72525";

const LINK_TYPE: Record<ProgrammeDependency["type"], ILink["type"]> = {
  FS: "e2s",
  SS: "s2s",
  FF: "e2e",
  SF: "s2e",
};

export const GANTT_LINK_TO_DEPENDENCY: Record<string, ProgrammeDependency["type"]> = {
  e2s: "FS",
  s2s: "SS",
  e2e: "FF",
  s2e: "SF",
};

export const linkId = (sourceId: string, targetId: string) => `${sourceId}->${targetId}`;

export function parseLinkId(id: string): { sourceId: string; targetId: string } | null {
  const [sourceId, targetId] = id.split("->");
  return sourceId && targetId ? { sourceId, targetId } : null;
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** Working days between two dates; the chart's bars are dragged in calendar days but the task stores working days. */
export function workingDaysBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;
  let count = 0;
  const cursor = new Date(from.getTime());
  while (cursor.getTime() < to.getTime()) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (!isWeekend(cursor)) count += 1;
  }
  return count;
}

export function buildProgrammeGantt(tasks: PreconProgrammeTask[]) {
  const parentIds = new Set(tasks.flatMap((t) => (t.parentTaskId ? [t.parentTaskId] : [])));
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  const rows: ProgrammeGanttTask[] = tasks
    .filter((t) => t.status !== "rejected")
    .map((t) => {
      const start = new Date(t.startAt);
      const end = t.isMilestone ? start : new Date(t.finishAt);
      const isSummary = parentIds.has(t.id);
      min = Math.min(min, start.getTime());
      max = Math.max(max, end.getTime());
      return {
        id: t.id,
        text: t.name,
        type: isSummary ? "summary" : t.isMilestone ? "milestone" : "task",
        parent: t.parentTaskId ?? ROOT,
        open: isSummary ? true : undefined,
        start,
        end,
        progress: t.status === "verified" ? 100 : 0,
        critical: t.isCritical,
        color: t.isCritical && !isSummary ? CRITICAL_COLOR : undefined,
        durationDays: t.durationDays,
        isMilestone: t.isMilestone,
      };
    });

  const emitted = new Set(rows.map((r) => r.id));
  for (const row of rows) {
    if (row.parent !== ROOT && !emitted.has(String(row.parent))) row.parent = ROOT;
  }

  const links: ILink[] = [];
  for (const task of tasks) {
    if (!emitted.has(task.id)) continue;
    for (const link of task.predecessors) {
      if (!emitted.has(link.taskId)) continue;
      links.push({
        id: linkId(link.taskId, task.id),
        source: link.taskId,
        target: task.id,
        type: LINK_TYPE[link.type],
        lag: link.lagDays,
      });
    }
  }

  const hasRange = Number.isFinite(min) && Number.isFinite(max);
  return {
    tasks: rows,
    links,
    rangeStart: hasRange ? new Date(min - 7 * DAY_MS) : undefined,
    rangeEnd: hasRange ? new Date(max + 14 * DAY_MS) : undefined,
    criticalCount: rows.filter((r) => r.critical && r.type !== "summary").length,
  };
}
