import { useEffect } from "react";
import { buildingsApi, realBuildings } from "@/api/buildings";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";

/** A remembered building is usable offline, but confirmed removal invalidates it. */
export function useProjectBuilding() {
  const { projectId, buildingId: savedId, selectBuilding, storageOwnerId } = useFieldSession();
  const query = usePersistentQuery({
    queryKey: ["projects", projectId, "buildings"],
    ownerId: storageOwnerId,
    queryFn: () => buildingsApi.list(projectId!),
    enabled: Boolean(projectId),
  });
  const buildings = query.data ? realBuildings(query.data) : [];
  const validId = query.data === undefined || buildings.some((b) => b.id === savedId) ? savedId : undefined;
  const buildingId = validId ?? (buildings.length === 1 ? buildings[0]?.id : undefined);

  useEffect(() => {
    if (query.data !== undefined && buildingId !== savedId) selectBuilding(buildingId);
  }, [query.data, buildingId, savedId, selectBuilding]);

  return {
    buildingId,
    building: buildings.find((b) => b.id === buildingId),
    buildings,
    needsChoice: !buildingId && buildings.length > 1,
    selectBuilding,
    isLoading: query.isPending && !buildingId,
    error: query.error,
    refetch: query.refetch,
  };
}
