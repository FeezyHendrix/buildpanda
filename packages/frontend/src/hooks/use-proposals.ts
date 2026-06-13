import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proposalsApi, type CreateProposalInput, type ProposalStatus } from "@/api/proposals";
import { proposalKeys } from "./query-keys";

export function usePublicProposal(token: string) {
  return useQuery({
    queryKey: ["public-proposal", token],
    queryFn: () => proposalsApi.getPublic(token),
    enabled: !!token,
    retry: false,
  });
}

export function useProposalComments(proposalId: string) {
  return useQuery({
    queryKey: ["proposal-comments", proposalId],
    queryFn: () => proposalsApi.listComments(proposalId),
    enabled: !!proposalId,
  });
}

export function usePostComment(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => proposalsApi.postComment(proposalId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposal-comments", proposalId] });
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
