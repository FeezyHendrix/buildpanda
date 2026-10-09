import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { stagesApi, type Stage } from "@/api/stages";
import { activitiesApi, type Activity } from "@/api/activities";
import { ApiError } from "@/api/client";
import { activityKeys, stageKeys } from "@/hooks/query-keys";
import { useProjectBuilding } from "@/hooks/use-project-building";
import { useFieldSession } from "./field-session";
import { usePersistentQuery } from "./persistent-query";
import { storage } from "./storage";
import { stageStorageKey, validStageId } from "./stage-filter";

interface StageScope {
  stageId: string | undefined;
  stage: Stage | undefined;
  stages: Stage[];
  activities: Activity[];
  activityStages: ReadonlyMap<string, string | null | undefined>;
  selectStage: (id: string | undefined) => void;
  isLoading: boolean;
  error: Error | null;
  canView: boolean;
  refetch: () => void;
}

const StageScopeContext = createContext<StageScope | null>(null);
const EMPTY_ACTIVITIES: Activity[] = [];

function ProjectStageScope({ storageKey, children }: { storageKey: string; children: ReactNode }) {
  const { projectId, storageOwnerId } = useFieldSession();
  const building = useProjectBuilding();
  const [savedId, setSavedId] = useState(() => storage.getItem(storageKey) || undefined);
  const query = usePersistentQuery({
    queryKey: stageKeys.list(projectId), ownerId: storageOwnerId,
    queryFn: () => stagesApi.list(projectId!), enabled: Boolean(projectId),
  });
  const activityQuery = usePersistentQuery({
    queryKey: activityKeys.list(projectId), ownerId: storageOwnerId,
    queryFn: () => activitiesApi.list(projectId!), enabled: Boolean(projectId && savedId),
  });
  const canView = !(query.error instanceof ApiError && [401, 403].includes(query.error.status));
  const stages = useMemo(() => (canView ? query.data ?? [] : []).filter((stage) =>
    !building.buildingId || stage.buildingId === building.buildingId || (building.buildings.length === 1 && !stage.buildingId),
  ), [canView, query.data, building.buildingId, building.buildings.length]);
  const stageId = canView ? validStageId(savedId, query.data === undefined ? undefined : stages) : undefined;
  const selectStage = useCallback((id: string | undefined) => {
    setSavedId(id);
    if (id) storage.setItem(storageKey, id);
    else storage.removeItem(storageKey);
  }, [storageKey]);
  useEffect(() => {
    if (stageId !== savedId) selectStage(stageId);
  }, [stageId, savedId, selectStage]);
  const activities = activityQuery.data ?? EMPTY_ACTIVITIES;
  const activityStages = useMemo(() => new Map(activities.map((activity) => [activity.id, activity.phaseId])), [activities]);
  const value: StageScope = {
    stageId, stage: stages.find((stage) => stage.id === stageId), stages, activities, activityStages, selectStage,
    isLoading: Boolean(projectId) && query.isPending,
    error: query.error,
    canView,
    refetch: () => { void query.refetch(); },
  };
  return <StageScopeContext.Provider value={value}>{children}</StageScopeContext.Provider>;
}

export function StageScopeProvider({ children }: { children: ReactNode }) {
  const { storageOwnerId, organizationId, projectId } = useFieldSession();
  const key = stageStorageKey(storageOwnerId, organizationId, projectId);
  return <ProjectStageScope key={key} storageKey={key}>{children}</ProjectStageScope>;
}

export function useStageScope() {
  const scope = useContext(StageScopeContext);
  if (!scope) throw new Error("useStageScope requires StageScopeProvider");
  return scope;
}
