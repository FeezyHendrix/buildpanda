import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface BuildingScope {
  /** The building the scoped pages filter by. `undefined` = all buildings (whole project). */
  selectedBuildingId: string | undefined;
  setSelectedBuildingId: (id: string | undefined) => void;
}

const BuildingScopeContext = createContext<BuildingScope>({
  selectedBuildingId: undefined,
  setSelectedBuildingId: () => undefined,
});

function storageKey(projectId: string): string {
  return `buildpanda:building-scope:${projectId}`;
}

export function BuildingScopeProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const [selectedBuildingId, setSelected] = useState<string | undefined>(() => {
    try {
      return sessionStorage.getItem(storageKey(projectId)) ?? undefined;
    } catch {
      return undefined;
    }
  });

  const setSelectedBuildingId = useCallback(
    (id: string | undefined) => {
      setSelected(id);
      try {
        if (id) sessionStorage.setItem(storageKey(projectId), id);
        else sessionStorage.removeItem(storageKey(projectId));
      } catch {
        // sessionStorage unavailable (private mode) — scope stays in memory only.
      }
    },
    [projectId],
  );

  const value = useMemo(
    () => ({ selectedBuildingId, setSelectedBuildingId }),
    [selectedBuildingId, setSelectedBuildingId],
  );

  return <BuildingScopeContext.Provider value={value}>{children}</BuildingScopeContext.Provider>;
}

/** The current building scope. `selectedBuildingId === undefined` means all buildings. */
export function useBuildingScope(): BuildingScope {
  return useContext(BuildingScopeContext);
}
