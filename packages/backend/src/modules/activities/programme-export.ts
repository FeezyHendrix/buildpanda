import { buildMspdiXml, type MspdiTask } from "../panda-ai/programme/mspdi-writer.ts";
import type { Activity } from "./types.ts";

/**
 * Renders the project's schedule as Microsoft Project XML (MSPDI), the mirror of
 * the programme importer. MS Project keys tasks by integer UID while activities
 * use string ids, so ids are numbered in schedule order and dependencies
 * resolved through that map — a predecessor pointing at an activity outside this
 * project (or a stale id) is dropped rather than emitted as a dangling link,
 * which MS Project rejects the file for.
 */
export function programmeToMspdiXml(projectName: string, activities: Activity[]): string {
  const ordered = [...activities].sort(
    (a, b) => Date.parse(a.plannedStartAt) - Date.parse(b.plannedStartAt),
  );

  const uidById = new Map<string, number>();
  ordered.forEach((activity, index) => uidById.set(activity.id, index + 1));

  const tasks: MspdiTask[] = ordered.map((activity) => ({
    uid: uidById.get(activity.id)!,
    name: activity.name,
    outlineLevel: activity.outlineLevel ?? 1,
    outlineNumber: activity.wbsCode,
    start: new Date(activity.plannedStartAt),
    finish: new Date(activity.plannedEndAt),
    durationDays: activity.durationDays,
    percentComplete: Math.round(activity.percentComplete),
    isMilestone: activity.isMilestone,
    isSummary: activity.isSummary,
    predecessors: activity.predecessors.flatMap((dep) => {
      const uid = uidById.get(dep.activityId);
      return uid === undefined ? [] : [{ uid, type: dep.type, lagDays: dep.lagDays }];
    }),
  }));

  const times = ordered.flatMap((a) => [
    Date.parse(a.plannedStartAt),
    Date.parse(a.plannedEndAt),
  ]);

  return buildMspdiXml({
    name: projectName,
    start: times.length ? new Date(Math.min(...times)) : null,
    finish: times.length ? new Date(Math.max(...times)) : null,
    tasks,
  });
}
