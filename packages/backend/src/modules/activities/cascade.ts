import { generateId } from "../../lib/ids.ts";
import { addWorkingDays, type WorkingCalendar } from "../../lib/working-days.ts";
import type { ActivitiesRepository } from "./repository.ts";
import type { ActivityDependency, ActivityRow, ShiftedActivity } from "./types.ts";

export interface CascadeRepository
  extends Pick<ActivitiesRepository, "listByProject" | "update" | "recordEvent"> {}

export interface CascadeDeps {
  repository: CascadeRepository;
  calendarFor(projectId: string): Promise<WorkingCalendar>;
  /** Carries the move on to anything anchored to these activities (key dates). */
  onActivitiesShifted?(projectId: string, moves: ShiftedActivity[]): Promise<void>;
}

export interface CascadeContext {
  actorId: string | null;
  delayId?: string | null;
  kind: string;
  summary: string;
}

function predecessorsOf(row: ActivityRow): ActivityDependency[] {
  const raw = row.predecessors;
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ActivityDependency[]) : [];
  } catch {
    return [];
  }
}

/** predecessor id -> the activities that follow it. */
function successorIndex(rows: ActivityRow[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const row of rows) {
    for (const dep of predecessorsOf(row)) {
      if (!dep?.activityId) continue;
      const bucket = index.get(dep.activityId);
      if (bucket) bucket.push(row.id);
      else index.set(dep.activityId, [row.id]);
    }
  }
  return index;
}

/**
 * Pushes an activity and every activity that follows it by `deltaWorkingDays`.
 *
 * The delta is signed: logging a 6-day delay shifts by +6, re-measuring it to 4
 * shifts by −2, and resolving it at 0 days pulls the whole chain back. That is
 * what makes the cascade reversible — callers keep the applied total on the
 * delay and only ever pass the difference.
 *
 * The planned FINISH always moves; the planned START moves only while the
 * activity has not started, because a bar that is already in progress has a
 * real start date and only its finish can slip. Baselines are stamped from the
 * pre-shift dates the first time an activity moves, so "variance" always means
 * variance against what was originally programmed.
 */
export async function cascadeShift(
  deps: CascadeDeps,
  projectId: string,
  activityId: string,
  deltaWorkingDays: number,
  context: CascadeContext,
): Promise<ShiftedActivity[]> {
  const delta = Math.trunc(deltaWorkingDays);
  if (delta === 0) return [];

  const rows = await deps.repository.listByProject(projectId);
  const byId = new Map(rows.map((row) => [row.id, row]));
  if (!byId.has(activityId)) return [];
  const successors = successorIndex(rows);
  const calendar = await deps.calendarFor(projectId);

  const visited = new Set<string>();
  const queue = [activityId];
  const moves: ShiftedActivity[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const row = byId.get(id);
    if (!row) continue;

    const plannedEnd = addWorkingDays(row.planned_end_at, delta, calendar);
    const patch: Parameters<CascadeRepository["update"]>[1] = { planned_end_at: plannedEnd };
    if (!row.actual_start_at) {
      patch.planned_start_at = addWorkingDays(row.planned_start_at, delta, calendar);
    }
    if (!row.baseline_start_at) patch.baseline_start_at = new Date(row.planned_start_at).toISOString();
    if (!row.baseline_end_at) patch.baseline_end_at = new Date(row.planned_end_at).toISOString();

    await deps.repository.update(id, patch);
    await deps.repository.recordEvent({
      id: generateId("aev"),
      project_id: projectId,
      activity_id: id,
      kind: context.kind,
      summary: context.summary,
      days_delta: delta,
      delay_id: context.delayId ?? null,
      actor_id: context.actorId,
    });
    moves.push({ id, name: row.name, days: delta, plannedEndAt: plannedEnd });

    for (const next of successors.get(id) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }

  if (deps.onActivitiesShifted && moves.length > 0) {
    await deps.onActivitiesShifted(projectId, moves);
  }
  return moves;
}
