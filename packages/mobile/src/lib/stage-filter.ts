/** An explicit assignment wins; legacy activity links supply the fallback. */
export function effectiveStageId(
  row: { stageId?: string | null; activityId?: string | null },
  activities: ReadonlyMap<string, string | null | undefined>,
): string | null | undefined {
  return row.stageId ?? (row.activityId ? activities.get(row.activityId) : undefined);
}

export function matchesStage(value: string | null | undefined, selected: string | undefined): boolean {
  return !selected || value === selected;
}

/** Keep a remembered selection while offline; clear confirmed deleted stages. */
export function validStageId(saved: string | undefined, stages: readonly { id: string }[] | undefined) {
  return !saved || stages === undefined || stages.some((stage) => stage.id === saved) ? saved : undefined;
}

export function stageStorageKey(ownerId: string | undefined, organizationId: string | undefined, projectId: string | undefined) {
  // SecureStore keys allow only alphanumeric characters, dots, dashes and underscores.
  return `buildpanda_stage_v1_${[ownerId, organizationId, projectId].map((part) =>
    Array.from(part ?? "").map((char) => char.codePointAt(0)!.toString(16)).join("-"),
  ).join("_")}`;
}
