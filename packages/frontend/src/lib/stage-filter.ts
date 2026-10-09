/** A missing selection includes unassigned records; an active selection is exact. */
export function matchesStage(stageId: string | null | undefined, selectedStageId: string | undefined): boolean {
  return !selectedStageId || stageId === selectedStageId;
}

export function stageActivityIds(
  activities: readonly { id: string; phaseId: string | null }[],
  stageId: string | undefined,
): Set<string> {
  return new Set(activities.filter((activity) => matchesStage(activity.phaseId, stageId)).map((activity) => activity.id));
}

export function matchesStageActivity(
  activityId: string | null | undefined,
  selectedStageId: string | undefined,
  activityIds: ReadonlySet<string>,
): boolean {
  return !selectedStageId || Boolean(activityId && activityIds.has(activityId));
}
