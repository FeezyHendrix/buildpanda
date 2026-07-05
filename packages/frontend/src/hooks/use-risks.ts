import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  risksApi,
  type CreateRiskVariables,
  type EditRiskVariables,
  type DeleteRiskVariables,
} from "@/api/risks";
import { riskKeys } from "./query-keys";

export type { CreateRiskVariables, EditRiskVariables, DeleteRiskVariables };

export function useProjectRiskFactors(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? riskKeys.all(projectId) : riskKeys.all("__none__"),
    queryFn: () => risksApi.list(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useCreateRiskFactor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, ...body }: CreateRiskVariables) =>
      risksApi.create(projectId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: riskKeys.all(projectId) });
    },
  });
}

export function useEditRiskFactor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, riskId, ...patch }: EditRiskVariables) =>
      risksApi.update(projectId, riskId, patch),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: riskKeys.all(projectId) });
    },
  });
}

export function useDeleteRiskFactor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, riskId }: DeleteRiskVariables) =>
      risksApi.remove(projectId, riskId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: riskKeys.all(projectId) });
    },
  });
}
