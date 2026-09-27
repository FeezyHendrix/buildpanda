import type { Activity } from "@/lib/project-types";
import { DAY_MS, parseDate } from "./schedule-utils";

interface CriticalScore {
  score: number;
  path: string[];
}

function activityWeight(activity: Activity): number {
  const start = parseDate(activity.plannedStartAt);
  const end = parseDate(activity.plannedEndAt) ?? start;
  if (!start || !end) return 0;
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
}

function computeActivityScore(
  activity: Activity,
  activityById: ReadonlyMap<string, Activity>,
  memo: Map<string, CriticalScore>,
  visiting: ReadonlySet<string>,
): CriticalScore {
  const cached = memo.get(activity.id);
  if (cached) return cached;
  if (visiting.has(activity.id)) return { score: activityWeight(activity), path: [activity.id] };

  const nextVisiting = new Set(visiting);
  nextVisiting.add(activity.id);
  let best: CriticalScore = { score: 0, path: [] };
  for (const predecessor of activity.predecessors) {
    const predecessorActivity = activityById.get(predecessor.activityId);
    if (!predecessorActivity) continue;
    const candidate = computeActivityScore(predecessorActivity, activityById, memo, nextVisiting);
    const score = candidate.score + Math.max(0, predecessor.lagDays);
    if (score > best.score) best = { score, path: candidate.path };
  }

  const result = {
    score: best.score + activityWeight(activity),
    path: [...best.path, activity.id],
  };
  memo.set(activity.id, result);
  return result;
}

export function computeCriticalActivityIds(
  activities: Activity[],
  emittedIds: ReadonlySet<string>,
): Set<string> {
  const activityById = new Map(activities.filter((activity) => emittedIds.has(activity.id)).map((activity) => [activity.id, activity]));
  const memo = new Map<string, CriticalScore>();
  let critical: CriticalScore = { score: 0, path: [] };

  for (const activity of activityById.values()) {
    const result = computeActivityScore(activity, activityById, memo, new Set());
    if (result.path.length > 1 && result.score >= critical.score) critical = result;
  }

  return new Set(critical.path);
}
