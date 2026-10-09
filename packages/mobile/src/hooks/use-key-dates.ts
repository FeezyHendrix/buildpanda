import { useStageScope } from "@/lib/stage-scope";
import { matchesStage } from "@/lib/stage-filter";
import { useMemo } from "react";
import { useProjectBuilding } from "./use-project-building";
import { filterBuildingRows } from "@/lib/building-scope";
import { keyDatesApi } from "@/api/key-dates";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";
import { keyDateKeys } from "./query-keys";

export function useKeyDates(projectId: string | undefined, enabled = true, scopeId?: string | null) {
  const { storageOwnerId } = useFieldSession();
  const { stageId, activityStages } = useStageScope();
  const scope = useProjectBuilding();
  const buildingId = scopeId === undefined ? scope.buildingId : scopeId;
  const query = usePersistentQuery({
    queryKey: keyDateKeys.list(projectId),
    ownerId: storageOwnerId,
    queryFn: () => keyDatesApi.list(projectId!),
    enabled: enabled && Boolean(projectId),
  });
  const data = useMemo(
    () => query.data && filterBuildingRows(query.data, buildingId, scope.buildings.length === 1)
      .filter((row) => scopeId !== undefined || matchesStage(row.linkedActivityId ? activityStages.get(row.linkedActivityId) : undefined, stageId)),
    [query.data, buildingId, scope.buildings.length, scopeId, stageId, activityStages],
  );
  return { ...query, data };
}
