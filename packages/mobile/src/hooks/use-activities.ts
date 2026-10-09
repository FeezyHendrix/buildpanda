import { useStageScope } from "@/lib/stage-scope";
import { matchesStage } from "@/lib/stage-filter";
import { useMemo } from "react";
import { useProjectBuilding } from "./use-project-building";
import { filterBuildingRows } from "@/lib/building-scope";
import { activitiesApi } from "@/api/activities";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";
import { activityKeys } from "./query-keys";

export function useActivities(projectId: string | undefined, enabled = true, scopeId?: string | null) {
  const { storageOwnerId } = useFieldSession();
  const { stageId } = useStageScope();
  const scope = useProjectBuilding();
  const buildingId = scopeId === undefined ? scope.buildingId : scopeId;
  const query = usePersistentQuery({
    queryKey: activityKeys.list(projectId),
    ownerId: storageOwnerId,
    queryFn: () => activitiesApi.list(projectId!),
    enabled: enabled && Boolean(projectId),
  });
  const data = useMemo(
    () => query.data && filterBuildingRows(query.data, buildingId, scope.buildings.length === 1)
      .filter((row) => scopeId !== undefined || matchesStage(row.phaseId, stageId)),
    [query.data, buildingId, scope.buildings.length, scopeId, stageId],
  );
  return { ...query, data };
}

/** The delay reasons a crew member can pick when work did not go to plan. */
export function useDelayReasons() {
  const { storageOwnerId } = useFieldSession();
  return usePersistentQuery({
    queryKey: ["delay-reasons"],
    ownerId: storageOwnerId,
    queryFn: activitiesApi.delayReasons,
  });
}
