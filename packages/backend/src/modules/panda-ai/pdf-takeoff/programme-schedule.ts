import type { ProgrammeDependency, ProgrammeDependencyType } from "./types.ts";

// Turns durations + dependencies into calendar dates (a CPM forward pass) and
// float + critical path (the backward pass). Programme tasks store no dates, so
// this runs on every read and on export — moving the site start re-plans the
// whole programme instead of orphaning it.
//
// All arithmetic happens in whole working days offset from the project start,
// then converts to calendar dates at the end. That keeps negative lags and
// finish-to-finish links exact instead of clamping them at a date boundary.

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
  lateStart: Date;
  lateFinish: Date;
  /** Working days the task can slip without moving the programme finish. */
  totalFloatDays: number;
  isCritical: boolean;
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** Construction programmes are quoted in working days, so weekends are skipped. Negative counts walk back. */
export function addWorkingDays(from: Date, days: number): Date {
  const result = new Date(from.getTime());
  let remaining = Math.round(days);
  const step = remaining < 0 ? -1 : 1;
  remaining = Math.abs(remaining);
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + step);
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
 * relaxing the one edge that closes the loop. Edits are rejected up front by
 * findDependencyCycle, so this relaxation only ever applies to drafted data.
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

/** Returns the ids on a dependency loop, or null when the graph is acyclic. */
export function findDependencyCycle(tasks: Pick<SchedulableTask, "id" | "predecessors">[]): string[] | null {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  const visit = (id: string): string[] | null => {
    const current = state.get(id);
    if (current === "done") return null;
    if (current === "visiting") return stack.slice(stack.indexOf(id)).concat(id);
    state.set(id, "visiting");
    stack.push(id);
    for (const link of byId.get(id)?.predecessors ?? []) {
      if (!byId.has(link.taskId)) continue;
      const found = visit(link.taskId);
      if (found) return found;
    }
    stack.pop();
    state.set(id, "done");
    return null;
  };

  for (const task of tasks) {
    const found = visit(task.id);
    if (found) return found;
  }
  return null;
}

/**
 * Parents follow from outline levels in sort order, exactly as the drafter
 * assigns them: a task's parent is the nearest task above it with a smaller
 * outline level. Re-run after any indent, outdent, reorder, insert or delete.
 */
export function deriveParentIds(tasks: { id: string; outlineLevel: number }[]): Map<string, string | null> {
  const parents = new Map<string, string | null>();
  const stack: { level: number; id: string }[] = [];
  for (const task of tasks) {
    while (stack.length && stack[stack.length - 1]!.level >= task.outlineLevel) stack.pop();
    parents.set(task.id, stack.length ? stack[stack.length - 1]!.id : null);
    stack.push({ level: task.outlineLevel, id: task.id });
  }
  return parents;
}

function earliestStart(
  type: ProgrammeDependencyType,
  predecessor: { es: number; ef: number },
  lagDays: number,
  durationDays: number,
): number {
  switch (type) {
    case "FS":
      return predecessor.ef + lagDays;
    case "SS":
      return predecessor.es + lagDays;
    case "FF":
      return predecessor.ef + lagDays - durationDays;
    case "SF":
      return predecessor.es + lagDays - durationDays;
  }
}

function latestFinish(
  type: ProgrammeDependencyType,
  successor: { ls: number; lf: number },
  lagDays: number,
  durationDays: number,
): number {
  switch (type) {
    case "FS":
      return successor.ls - lagDays;
    case "SS":
      return successor.ls - lagDays + durationDays;
    case "FF":
      return successor.lf - lagDays;
    case "SF":
      return successor.lf - lagDays + durationDays;
  }
}

interface Window {
  es: number;
  ef: number;
  ls: number;
  lf: number;
}

export function scheduleProgramme(
  tasks: SchedulableTask[],
  projectStart: Date,
): Map<string, ScheduledDates> {
  const start = nextWorkingDay(projectStart);
  const order = topologicalOrder(tasks);
  const windows = new Map<string, Window>();
  const duration = (task: SchedulableTask) => Math.max(0, Math.round(task.durationDays));

  // Forward pass: earliest start is the latest of every predecessor constraint.
  for (const task of order) {
    let es = 0;
    for (const link of task.predecessors) {
      const predecessor = windows.get(link.taskId);
      if (!predecessor) continue;
      es = Math.max(es, earliestStart(link.type, predecessor, link.lagDays, duration(task)));
    }
    windows.set(task.id, { es, ef: es + duration(task), ls: 0, lf: 0 });
  }

  // A parent carries no duration of its own; it spans its children. Deepest
  // levels roll up first so a three-level tree aggregates correctly.
  const byLevelDesc = [...tasks].sort((a, b) => b.outlineLevel - a.outlineLevel);
  const parentIds = new Set(tasks.flatMap((t) => (t.parentTaskId ? [t.parentTaskId] : [])));
  for (const task of byLevelDesc) {
    if (!task.parentTaskId) continue;
    const child = windows.get(task.id);
    const parent = windows.get(task.parentTaskId);
    if (!child || !parent) continue;
    parent.es = Math.min(parent.es, child.es);
    parent.ef = Math.max(parent.ef, child.ef);
  }

  const projectFinish = Math.max(0, ...[...windows.values()].map((w) => w.ef));

  // Backward pass: latest finish is the earliest of every successor constraint.
  const successors = new Map<string, { task: SchedulableTask; link: ProgrammeDependency }[]>();
  for (const task of tasks) {
    for (const link of task.predecessors) {
      const list = successors.get(link.taskId) ?? [];
      list.push({ task, link });
      successors.set(link.taskId, list);
    }
  }
  for (const task of [...order].reverse()) {
    const window = windows.get(task.id)!;
    let lf = projectFinish;
    for (const { task: successor, link } of successors.get(task.id) ?? []) {
      const next = windows.get(successor.id);
      if (!next || parentIds.has(successor.id)) continue;
      lf = Math.min(lf, latestFinish(link.type, next, link.lagDays, duration(task)));
    }
    window.lf = lf;
    window.ls = lf - duration(task);
  }
  // Parents take the widest late window of their children, so a summary bar
  // is critical exactly when one of its children is.
  for (const task of byLevelDesc) {
    if (!task.parentTaskId) continue;
    const child = windows.get(task.id);
    const parent = windows.get(task.parentTaskId);
    if (!child || !parent) continue;
    parent.ls = Math.min(parent.ls, child.ls);
    parent.lf = Math.max(parent.lf, child.lf);
  }

  const dates = new Map<string, ScheduledDates>();
  for (const task of tasks) {
    const window = windows.get(task.id);
    if (!window) continue;
    const totalFloatDays = Math.max(0, window.ls - window.es);
    dates.set(task.id, {
      start: addWorkingDays(start, window.es),
      finish: addWorkingDays(start, window.ef),
      lateStart: addWorkingDays(start, window.ls),
      lateFinish: addWorkingDays(start, window.lf),
      totalFloatDays,
      isCritical: totalFloatDays === 0,
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
