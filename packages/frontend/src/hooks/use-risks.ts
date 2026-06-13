import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { riskKeys } from "./query-keys";
import type { RiskFactor, RiskLevel } from "@/lib/project-types";

export function useProjectRiskFactors(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? riskKeys.all(projectId) : riskKeys.all("__none__"),
    queryFn: async () => {
      const { data } = await api.get<RiskFactor[]>(
        `/projects/${projectId!}/risk-factors`,
      );
      return data;
    },
    enabled: Boolean(projectId),
  });
}

interface CreateRiskVariables {
  projectId: string;
  title: string;
  description: string;
  severity: RiskLevel;
}

export function useCreateRiskFactor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, ...body }: CreateRiskVariables) => {
      const { data } = await api.post<RiskFactor>(
        `/projects/${projectId}/risk-factors`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: riskKeys.all(projectId) });
    },
  });
}

interface EditRiskVariables {
  projectId: string;
  riskId: string;
  title?: string;
  description?: string;
  severity?: RiskLevel;
}

export function useEditRiskFactor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, riskId, ...patch }: EditRiskVariables) => {
      const { data } = await api.put<RiskFactor>(
        `/projects/${projectId}/risk-factors/${riskId}`,
        patch,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: riskKeys.all(projectId) });
    },
  });
}

interface DeleteRiskVariables {
  projectId: string;
  riskId: string;
}

export function useDeleteRiskFactor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, riskId }: DeleteRiskVariables) => {
      await api.delete(`/projects/${projectId}/risk-factors/${riskId}`);
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: riskKeys.all(projectId) });
    },
  });
}
