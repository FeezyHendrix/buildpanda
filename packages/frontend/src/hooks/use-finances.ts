import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  financesApi,
  type AddCashFlowVariables,
  type DepositVariables,
  type UpsertMilestoneInput,
  type DeleteMilestoneInput,
  type ReleaseVariables,
  type RaiseDisputeVariables,
  type UpdateContractSumVariables,
  type RecordVariationVariables,
} from "@/api/finances";
import type { UpdateContractTermsInput } from "@/lib/project-types";
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

export function useCashFlowEntries(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? [...financeKeys.all(projectId), "cash-flow"]
      : ["__none__"],
    queryFn: () => financesApi.cashFlow.list(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useAddCashFlowEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, ...body }: AddCashFlowVariables) =>
      financesApi.cashFlow.create(projectId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: [...financeKeys.all(projectId), "cash-flow"] });
      queryClient.invalidateQueries({ queryKey: financeKeys.summary(projectId) });
      queryClient.invalidateQueries({ queryKey: financeKeys.events(projectId) });
    },
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

export function useUpdateContractSum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, contractSum }: UpdateContractSumVariables) =>
      financesApi.updateContractSum(projectId, contractSum),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: financeKeys.all(projectId) });
    },
  });
}

export function useRecordVariation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, amount, description }: RecordVariationVariables) =>
      financesApi.recordVariation(projectId, amount, description),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: financeKeys.all(projectId) });
    },
  });
}

export interface UpdateContractTermsVariables extends UpdateContractTermsInput {
  projectId: string;
}

export function useUpdateContractTerms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, ...body }: UpdateContractTermsVariables) =>
      financesApi.updateContractTerms(projectId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: financeKeys.all(projectId) });
    },
  });
}
