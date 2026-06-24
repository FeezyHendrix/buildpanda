import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proposalsApi, type CreateProposalInput, type ProposalStatus } from "@/api/proposals";
import { proposalKeys } from "./query-keys";

export function usePublicProposal(token: string) {
  return useQuery({
    queryKey: proposalKeys.publicView(token),
    queryFn: () => proposalsApi.getPublic(token),
    enabled: !!token,
    retry: false,
  });
}

export function useProposalComments(proposalId: string) {
  return useQuery({
    queryKey: proposalKeys.comments(proposalId),
    queryFn: () => proposalsApi.listComments(proposalId),
    enabled: !!proposalId,
  });
}

export function usePostComment(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => proposalsApi.postComment(proposalId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.comments(proposalId) });
    },
  });
}

export function useSendEstimate(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (estimateId: string) => proposalsApi.sendEstimate(proposalId, estimateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) });
    },
  });
}

export function useConvertProposal(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => proposalsApi.convert(proposalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) });
    },
  });
}

export function useProposalPlans(proposalId: string) {
  return useQuery({
    queryKey: proposalKeys.plans(proposalId),
    queryFn: () => proposalsApi.listPlans(proposalId),
    enabled: !!proposalId,
  });
}

export function useAddPlan(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { fileId: string; label?: string }) => proposalsApi.addPlan(proposalId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.plans(proposalId) });
    },
  });
}

export function useDeletePlan(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => proposalsApi.deletePlan(proposalId, planId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.plans(proposalId) });
    },
  });
}

export function useProposalTakeoffs(proposalId: string) {
  return useQuery({
    queryKey: proposalKeys.takeoffs(proposalId),
    queryFn: () => proposalsApi.listAutomatedTakeoffs(proposalId),
    enabled: !!proposalId,
    refetchInterval: (query) =>
      query.state.data?.some((job) => job.status === "pending" || job.status === "processing")
        ? 3000
        : false,
  });
}

export function useStartProposalTakeoff(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => proposalsApi.startAutomatedTakeoff(proposalId, planId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.takeoffs(proposalId) });
      qc.invalidateQueries({ queryKey: proposalKeys.boq(proposalId) });
    },
  });
}

export function useProposalBoq(proposalId: string) {
  return useQuery({
    queryKey: proposalKeys.boq(proposalId),
    queryFn: () => proposalsApi.listBoq(proposalId),
    enabled: !!proposalId,
  });
}

export function useReplaceBoq(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: Array<{ groupLabel: string; description: string; qty: number; unit: string; sort: number }>) =>
      proposalsApi.replaceBoq(proposalId, items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.boq(proposalId) });
    },
  });
}

export function useProposals(filters?: { status?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: proposalKeys.list(filters),
    queryFn: () => proposalsApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useProposalWorkspace(id: string) {
  return useQuery({
    queryKey: proposalKeys.detail(id),
    queryFn: () => proposalsApi.getWorkspace(id),
    enabled: !!id,
  });
}

export function useCreateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProposalInput) => proposalsApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.all });
    },
  });
}

export function useUpdateProposal(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<CreateProposalInput & { status: ProposalStatus; validUntil: string | null }>) =>
      proposalsApi.patch(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.all });
    },
  });
}

export function useCreateEstimate(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { changeNote?: string }) => proposalsApi.createEstimate(proposalId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) });
    },
  });
}

export function usePatchEstimate(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      estimateId,
      ...body
    }: {
      estimateId: string;
      contingencyPct?: number;
      taxLabel?: string;
      taxPct?: number;
    }) => proposalsApi.patchEstimate(proposalId, estimateId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) });
    },
  });
}
