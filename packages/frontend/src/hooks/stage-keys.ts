// Split out of query-keys.ts (which re-exports it) to keep that file under the size ceiling.
export const stageKeys = {
  all: (projectId: string) => ["projects", projectId, "stages"] as const,
  list: (projectId: string, buildingId?: string) => [...stageKeys.all(projectId), "list", buildingId ?? "all"] as const,
  // Under `all` on purpose: a phase's count, progress and status are derived
  // from its stages, so every stage mutation must refetch the phases too.
  buildingPhases: (projectId: string, buildingId?: string) =>
    [...stageKeys.all(projectId), "building-phases", buildingId ?? "all"] as const,
  scheduleOfValues: (projectId: string, stageId?: string) =>
    [...stageKeys.all(projectId), "schedule-of-values", stageId ?? "__none__"] as const,
  // Its own key: sharing one with a disabled per-stage query let that query's
  // fn (stage "undefined") answer a project-wide refetch with an empty list.
  valueSummary: (projectId: string) =>
    [...stageKeys.all(projectId), "value-summary"] as const,
  projectScheduleOfValues: (projectId: string) =>
    [...stageKeys.all(projectId), "schedule-of-values", "project"] as const,
};
