import { useMemo } from "react";
import { useProjectBuilding } from "./use-project-building";
import { filterBuildingRows } from "@/lib/building-scope";
import { stagesApi } from "@/api/stages";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";
import { stageKeys } from "./query-keys";

export function useStages(projectId: string | undefined, enabled = true, scopeId?: string | null) {
  const { storageOwnerId } = useFieldSession();
  const scope = useProjectBuilding();
  const buildingId = scopeId === undefined ? scope.buildingId : scopeId;
  const query = usePersistentQuery({
    queryKey: stageKeys.list(projectId),
    ownerId: storageOwnerId,
    queryFn: () => stagesApi.list(projectId!),
    enabled: enabled && Boolean(projectId),
  });
  const data = useMemo(
    () => query.data && filterBuildingRows(query.data, buildingId, scope.buildings.length === 1),
    [query.data, buildingId, scope.buildings.length],
  );
  return { ...query, data };
}
