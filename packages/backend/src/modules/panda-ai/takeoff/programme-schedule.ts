import type { ProgrammeDependency, ProgrammeDependencyType } from "./types.ts";

// Turns durations + dependencies into calendar dates (a CPM forward pass).
// Programme tasks store no dates, so this runs on every read and on export —
// moving the site start re-plans the whole programme instead of orphaning it.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface SchedulableTask {
  id: string;
  durationDays: number;
  predecessors: ProgrammeDependency[];
  outlineLevel: number;
  parentTaskId: string | null;
}

export interface ScheduledDates {
  start: Date;
  finish: Date;
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** Construction programmes are quoted in working days, so weekends are skipped. */
export function addWorkingDays(from: Date, days: number): Date {
  const result = new Date(from.getTime());
  let remaining = Math.max(0, Math.round(days));
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (!isWeekend(result)) remaining -= 1;
  }
  return result;
}

function nextWorkingDay(date: Date): Date {
  const result = new Date(date.getTime());
  while (isWeekend(result)) result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

/**
 * Depth-first topological order. Tasks in a dependency cycle are emitted once
 * their non-cyclic predecessors are placed: a generated programme can contain a
 * bad link, and refusing to schedule the whole thing would be worse than
 * relaxing the one edge that closes the loop.
 */
function topologicalOrder(tasks: SchedulableTask[]): SchedulableTask[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const ordered: SchedulableTask[] = [];
  const state = new Map<string, "visiting" | "done">();

  const visit = (task: SchedulableTask): void => {
    const current = state.get(task.id);
    if (current === "done" || current === "visiting") return;
    state.set(task.id, "visiting");
    for (const link of task.predecessors) {
      const predecessor = byId.get(link.taskId);
      if (predecessor) visit(predecessor);
    }
    state.set(task.id, "done");
    ordered.push(task);
  };

  for (const task of tasks) visit(task);
  return ordered;
}

function constrainedStart(
  type: ProgrammeDependencyType,
  predecessor: ScheduledDates,
  lagDays: number,
  durationDays: number,
): Date {
  switch (type) {
    case "FS":
      return addWorkingDays(predecessor.finish, lagDays);
    case "SS":
      return addWorkingDays(predecessor.start, lagDays);
    case "FF":
      return addWorkingDays(predecessor.finish, lagDays - durationDays);
    case "SF":
      return addWorkingDays(predecessor.start, lagDays - durationDays);
  }
}

export function scheduleProgramme(
  tasks: SchedulableTask[],
  projectStart: Date,
): Map<string, ScheduledDates> {
  const start = nextWorkingDay(projectStart);
  const dates = new Map<string, ScheduledDates>();

  for (const task of topologicalOrder(tasks)) {
    let taskStart = start;
    for (const link of task.predecessors) {
      const predecessor = dates.get(link.taskId);
      if (!predecessor) continue;
      const candidate = constrainedStart(link.type, predecessor, link.lagDays, task.durationDays);
      if (candidate.getTime() > taskStart.getTime()) taskStart = candidate;
    }
    taskStart = nextWorkingDay(taskStart);
    dates.set(task.id, {
      start: taskStart,
      finish: addWorkingDays(taskStart, task.durationDays),
    });
  }

  // A parent carries no duration of its own; it spans its children. Deepest
  // levels roll up first so a three-level tree aggregates correctly.
  const byLevelDesc = [...tasks].sort((a, b) => b.outlineLevel - a.outlineLevel);
  for (const task of byLevelDesc) {
    if (!task.parentTaskId) continue;
    const child = dates.get(task.id);
    const parent = dates.get(task.parentTaskId);
    if (!child || !parent) continue;
    dates.set(task.parentTaskId, {
      start: new Date(Math.min(parent.start.getTime(), child.start.getTime())),
      finish: new Date(Math.max(parent.finish.getTime(), child.finish.getTime())),
    });
  }

  return dates;
}

/** Working days between two dates, for reporting a programme's total span. */
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

export const PROGRAMME_MS_PER_DAY = MS_PER_DAY;
