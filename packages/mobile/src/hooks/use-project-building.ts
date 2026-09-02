import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { buildingsApi, realBuildings, type Building } from "@/api/buildings";
import { useFieldSession } from "@/lib/field-session";

export interface ProjectBuilding {
  /** The building writes should be filed against, once known. */
  buildingId: string | undefined;
  buildings: Building[];
  /** True when the crew member must choose before a building-scoped write. */
  needsChoice: boolean;
  selectBuilding: (buildingId: string) => void;
  isLoading: boolean;
}

/**
 * Resolves which building a write belongs to.
 *
 * A project with one real building needs no decision, so it is selected
 * silently — the API resolves it server-side anyway, and asking would be noise.
 * With several, the choice is the crew member's: filing a daily log or look
 * ahead against the wrong block is a contractual record in the wrong place.
 */
export function useProjectBuilding(): ProjectBuilding {
  const { projectId, buildingId, selectBuilding } = useFieldSession();

  const { data, isLoading } = useQuery({
    queryKey: ["projects", projectId, "buildings"],
    queryFn: () => buildingsApi.list(projectId!),
    enabled: Boolean(projectId),
    staleTime: 5 * 60_000,
  });

  const buildings = data ? realBuildings(data) : [];
  const only = buildings.length === 1 ? buildings[0] : undefined;

  useEffect(() => {
    if (!buildingId && only) selectBuilding(only.id);
  }, [buildingId, only, selectBuilding]);

  const resolved = buildingId ?? only?.id;

  return {
    buildingId: resolved,
    buildings,
    needsChoice: !resolved && buildings.length > 1,
    selectBuilding,
    isLoading,
  };
}
