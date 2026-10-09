import { createContext, useContext, useState, type ReactNode } from "react";
import { useStages } from "@/hooks/use-stages";
import { canResourceAction, type ProjectAccess, type Stage } from "@/lib/project-types";

interface StageScope {
  stages: Stage[];
  selectedStageId: string | undefined;
  setSelectedStageId: (id: string | undefined) => void;
  canFilterStages: boolean;
  isLoading: boolean;
}

const StageScopeContext = createContext<StageScope>({
  stages: [],
  selectedStageId: undefined,
  setSelectedStageId: () => undefined,
  canFilterStages: false,
  isLoading: false,
});

function storageKey(projectId: string): string {
  return `buildpanda:stage-scope:v1:${projectId}`;
}

/** The provider is keyed by project, so a selection never carries into another project. */
export function StageScopeProvider({ projectId, access, children }: {
  projectId: string;
  access: ProjectAccess | undefined;
  children: ReactNode;
}) {
  const canFilterStages = Boolean(access && canResourceAction(access, "stages", "view"));
  const { data: stages = [], isLoading } = useStages(canFilterStages ? projectId : undefined);
  const [storedId, setStoredId] = useState<string | undefined>(() => {
    try { return sessionStorage.getItem(storageKey(projectId)) ?? undefined; }
    catch { return undefined; }
  });
  // A deleted stage or a changed role must not leave the workspace silently filtered.
  const selectedStageId = canFilterStages && stages.some((stage) => stage.id === storedId)
    ? storedId : undefined;

  function setSelectedStageId(id: string | undefined): void {
    setStoredId(id);
    try {
      if (id) sessionStorage.setItem(storageKey(projectId), id);
      else sessionStorage.removeItem(storageKey(projectId));
    } catch { /* The filter still works when browser storage is unavailable. */ }
  }

  return (
    <StageScopeContext.Provider value={{ stages, selectedStageId, setSelectedStageId, canFilterStages, isLoading }}>
      {children}
    </StageScopeContext.Provider>
  );
}

export function useStageScope(): StageScope {
  return useContext(StageScopeContext);
}
