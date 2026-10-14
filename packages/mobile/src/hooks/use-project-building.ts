import { features } from "@/lib/feature-access";
import { useEffect } from "react";
import { buildingsApi, realBuildings } from "@/api/buildings";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";

/**
 * A project with one building has nothing to pick, so telling its crew to
 * "choose a building" was a dead end: the id is simply not on the device yet.
 */
export function missingBuilding(buildingCount: number): Error {
  return new Error(
    buildingCount > 1
      ? "Choose a building first."
      : "Buildings have not reached this device yet. Reconnect once, then try again.",
  );
}

/** A remembered building is usable offline, but confirmed removal invalidates it. */
export function useProjectBuilding() {
  const { projectId, buildingId: savedId, selectBuilding, storageOwnerId } = useFieldSession();
  const query = usePersistentQuery({
    queryKey: ["projects", projectId, "buildings"],
    ownerId: storageOwnerId,
    projectId,
    permission: features.buildings.read,
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
