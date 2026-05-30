import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { financeKeys } from "./query-keys";
import type {
  MilestoneDispute,
  MilestonePayment,
  ProjectFinances,
} from "@/lib/project-mock-data";

export function useProjectFinances(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? financeKeys.summary(projectId)
      : financeKeys.summary("__none__"),
    queryFn: async () => {
      const { data } = await api.get<ProjectFinances>(
        `/projects/${projectId!}/finances`,
      );
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useMilestoneDisputes(
  projectId: string | undefined,
  milestoneId: string | undefined,
) {
  return useQuery({
    queryKey:
      projectId && milestoneId
        ? financeKeys.milestoneDisputes(projectId, milestoneId)
        : financeKeys.milestoneDisputes("__none__", "__none__"),
    queryFn: async () => {
      const { data } = await api.get<MilestoneDispute[]>(
        `/projects/${projectId!}/finances/milestones/${milestoneId!}/disputes`,
      );
      return data;
    },
    enabled: Boolean(projectId && milestoneId),
  });
}

interface DepositVariables {
  projectId: string;
  amount: number;
  description?: string;
}

export function useFundProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, amount, description }: DepositVariables) => {
      const { data } = await api.post<ProjectFinances>(
        `/projects/${projectId}/finances/deposits`,
        { amount, ...(description ? { description } : {}) },
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: financeKeys.summary(projectId) });
    },
  });
}

interface ReleaseVariables {
  projectId: string;
  milestoneId: string;
}

export function useReleaseMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, milestoneId }: ReleaseVariables) => {
      const { data } = await api.post<MilestonePayment>(
        `/projects/${projectId}/finances/milestones/${milestoneId}/release`,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: financeKeys.summary(projectId) });
    },
  });
}

interface RaiseDisputeVariables {
  projectId: string;
  milestoneId: string;
  reason: string;
}

export function useRaiseDispute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      milestoneId,
      reason,
    }: RaiseDisputeVariables) => {
      const { data } = await api.post<MilestoneDispute>(
        `/projects/${projectId}/finances/milestones/${milestoneId}/disputes`,
        { reason },
      );
      return data;
    },
    onSuccess: (_data, { projectId, milestoneId }) => {
      queryClient.invalidateQueries({
        queryKey: financeKeys.milestoneDisputes(projectId, milestoneId),
      });
    },
  });
}
