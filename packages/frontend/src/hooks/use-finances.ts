import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  financesApi,
  type DepositVariables,
  type UpsertMilestoneInput,
  type DeleteMilestoneInput,
  type ReleaseVariables,
  type RaiseDisputeVariables,
} from "@/api/finances";
import { financeKeys } from "./query-keys";

export function useProjectFinances(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? financeKeys.summary(projectId)
      : financeKeys.summary("__none__"),
    queryFn: () => financesApi.summary(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useFinanceEvents(projectId: string | undefined) {
  return useQuery({
    queryKey: financeKeys.events(projectId ?? "__none__"),
    queryFn: () => financesApi.events(projectId!),
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
    queryFn: () => financesApi.milestoneDisputes(projectId!, milestoneId!),
    enabled: Boolean(projectId && milestoneId),
  });
}

export function useFundProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, amount, description }: DepositVariables) => 
      financesApi.deposit(projectId, { amount, ...(description ? { description } : {}) }),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: financeKeys.all(projectId) });
    },
  });
}

export function useUpsertMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      milestoneId,
      ...body
    }: UpsertMilestoneInput) => 
      financesApi.upsertMilestone(projectId, milestoneId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: financeKeys.all(projectId) });
    },
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, milestoneId }: DeleteMilestoneInput) => 
      financesApi.deleteMilestone(projectId, milestoneId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: financeKeys.all(projectId) });
    },
  });
}

export function useReleaseMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, milestoneId }: ReleaseVariables) => 
      financesApi.releaseMilestone(projectId, milestoneId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: financeKeys.all(projectId) });
    },
  });
}

export function useRaiseDispute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      milestoneId,
      reason,
    }: RaiseDisputeVariables) => 
      financesApi.raiseDispute(projectId, milestoneId, { reason }),
    onSuccess: (_data, { projectId, milestoneId }) => {
      queryClient.invalidateQueries({
        queryKey: financeKeys.milestoneDisputes(projectId, milestoneId),
      });
      queryClient.invalidateQueries({ queryKey: financeKeys.events(projectId) });
    },
  });
}
