import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildingsApi, type BuildingInput } from "@/api/buildings";
import { useFeatureFlagState } from "./use-feature-flags";
import { buildingKeys, stageKeys } from "./query-keys";

export type { BuildingInput };

export function useBuildings(projectId: string | undefined) {
  // The API rejects /projects/:id/buildings outright while projects.multiBuilding
  // is off, so requesting it anyway is a guaranteed 403 on every project page.
  // Fail closed while the flags load — useFeatureFlag reads enabled when it has
  // no data yet, which would still fire the doomed request on first paint.
  const { enabled: multiBuilding, isLoading: flagsLoading } =
    useFeatureFlagState("projects.multiBuilding");

  return useQuery({
    queryKey: buildingKeys.list(projectId ?? "__none__"),
    queryFn: () => buildingsApi.list(projectId!),
    enabled: Boolean(projectId) && !flagsLoading && multiBuilding,
  });
}

export function useCreateBuilding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...body }: BuildingInput & { projectId: string }) =>
      buildingsApi.create(projectId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: buildingKeys.all(projectId) });
    },
  });
}

export function useUpdateBuilding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      buildingId,
      ...body
    }: Partial<BuildingInput> & { projectId: string; buildingId: string }) =>
      buildingsApi.update(projectId, buildingId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: buildingKeys.all(projectId) });
    },
  });
}

export function useDeleteBuilding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, buildingId }: { projectId: string; buildingId: string }) =>
      buildingsApi.remove(projectId, buildingId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: buildingKeys.all(projectId) });
    },
  });
}

export function useReorderBuildings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, buildingIds }: { projectId: string; buildingIds: string[] }) =>
      buildingsApi.reorder(projectId, buildingIds),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: buildingKeys.all(projectId) });
    },
  });
}

export function useCloneProgramme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      buildingId,
      fromBuildingId,
    }: {
      projectId: string;
      buildingId: string;
      fromBuildingId: string;
    }) => buildingsApi.cloneProgramme(projectId, buildingId, fromBuildingId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: stageKeys.all(projectId) });
    },
  });
}
