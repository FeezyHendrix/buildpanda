import type { Activity, KeyDate } from "@/lib/project-types";
import { stageActivityIds } from "@/lib/stage-filter";
import type { buildGanttData } from "./schedule-gantt-data";
import { delaySummary } from "./schedule-utils";

/** Filter the rendered chart after computing the critical path on the full programme. */
export function filterGanttByStage(
  data: ReturnType<typeof buildGanttData>,
  activities: Activity[],
  keyDates: KeyDate[],
  stageId?: string,
): ReturnType<typeof buildGanttData> {
  if (!stageId) return data;
  const activityIds = stageActivityIds(activities, stageId);
  const included = new Set([stageId, ...activityIds]);
  for (const activity of activities) {
    if (!activityIds.has(activity.id)) continue;
    for (const delay of activity.delays) included.add(`${activity.id}-${delay.id}`);
  }
  for (const keyDate of keyDates) {
    if (keyDate.linkedActivityId && activityIds.has(keyDate.linkedActivityId)) included.add(`keydate:${keyDate.id}`);
  }
  const visible = data.tasks.filter((task) => included.has(String(task.id)));
  const rendered = new Set(visible.map((task) => String(task.id)));
  return {
    ...data,
    tasks: visible.map((task) => ({ ...task, parent: rendered.has(String(task.parent)) ? task.parent : 0 })),
    links: data.links.filter((link) => rendered.has(String(link.source)) && rendered.has(String(link.target))),
    delays: delaySummary(activities.filter((activity) => activityIds.has(activity.id))),
    criticalCount: visible.filter((task) => task.critical).length,
  };
}
