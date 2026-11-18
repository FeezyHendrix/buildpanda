import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildingPhasesApi, type BuildingPhase, type CreateBuildingPhaseInput } from "@/api/building-phases";
import { useProjectAccess } from "./use-participants";
import { stageKeys } from "./query-keys";

export type { BuildingPhase };

/** Exact-action check on the server-computed access map; unknown access denies. */
function useStagePermission(projectId: string | undefined, action: "view" | "manage"): boolean {
  const { data: access, isError } = useProjectAccess(projectId);
  return !isError && access?.permissions?.stages?.includes(action) === true;
}

export function useBuildingPhases(projectId: string | undefined, buildingId?: string) {
  const canRead = useStagePermission(projectId, "view");
  const query = useQuery({
    queryKey: stageKeys.buildingPhases(projectId ?? "__none__", buildingId),
    queryFn: () => buildingPhasesApi.list(projectId!, buildingId),
    enabled: Boolean(projectId) && canRead,
  });
  // Disabling a query does not drop what it cached while access was held.
  return { ...query, data: canRead ? query.data : undefined };
}

export function useCreateBuildingPhase(projectId: string) {
  const queryClient = useQueryClient();
  const canManage = useStagePermission(projectId, "manage");
  return useMutation({
    mutationFn: (input: CreateBuildingPhaseInput) => {
      if (!canManage) throw new Error("You don't have permission to add building phases.");
      return buildingPhasesApi.create(projectId, input);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stageKeys.all(projectId) }),
  });
}

export function useUpdateBuildingPhase(projectId: string) {
  const queryClient = useQueryClient();
  const canManage = useStagePermission(projectId, "manage");
  return useMutation({
    mutationFn: ({ phaseId, name }: { phaseId: string; name: string }) => {
      if (!canManage) throw new Error("You don't have permission to rename building phases.");
      return buildingPhasesApi.rename(projectId, phaseId, name);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stageKeys.all(projectId) }),
  });
}
