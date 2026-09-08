import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  proposalsApi,
  type AddPlanInput,
  type ConvertInclude,
  type CreateProposalInput,
  type PackOrigin,
  type PackSectionKind,
  type PaymentScheduleItem,
  type ProposalStatus,
  type UpdateEstimateTermsInput,
  type UpdatePlanInput,
} from "@/api/proposals";
import { proposalKeys, proposalPackKeys } from "./query-keys";

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
    mutationFn: (include?: ConvertInclude) => proposalsApi.convert(proposalId, include),
    onSuccess: () => {
      // Conversion changes the proposal status, so lists go stale too.
      qc.invalidateQueries({ queryKey: proposalKeys.all });
    },
  });
}

// The preview is a POST that writes nothing; it is queried on demand when the
// convert dialog opens so the counts reflect the take-off as it stands now.
export function useConvertPreview(proposalId: string, enabled: boolean) {
  return useQuery({
    queryKey: proposalKeys.convertPreview(proposalId),
    queryFn: () => proposalsApi.convertPreview(proposalId),
    enabled: enabled && !!proposalId,
    staleTime: 0,
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
    mutationFn: (body: AddPlanInput) => proposalsApi.addPlan(proposalId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.plans(proposalId) });
    },
  });
}

export function useUpdatePlan(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, ...body }: UpdatePlanInput & { planId: string }) =>
      proposalsApi.updatePlan(proposalId, planId, body),
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

export function usePatchEstimateTerms(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, ...body }: { estimateId: string } & UpdateEstimateTermsInput) =>
      proposalsApi.patchEstimateTerms(proposalId, estimateId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) });
    },
  });
}

export function useReplacePaymentSchedule(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      estimateId,
      items,
    }: {
      estimateId: string;
      items: Array<Omit<PaymentScheduleItem, "id" | "estimateId" | "description"> & { description?: string }>;
    }) => proposalsApi.replaceSchedule(proposalId, estimateId, items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) });
    },
  });
}

export function useProposalPack(proposalId: string) {
  return useQuery({
    queryKey: proposalPackKeys.all(proposalId),
    queryFn: () => proposalsApi.listPack(proposalId),
    enabled: !!proposalId,
  });
}

export function useUpsertPackSection(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { kind: PackSectionKind; bodyHtml: string; origin?: PackOrigin }) =>
      proposalsApi.upsertPackSection(proposalId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalPackKeys.all(proposalId) });
    },
  });
}

export function useDraftPack(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kinds?: PackSectionKind[]) => proposalsApi.draftPack(proposalId, kinds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalPackKeys.all(proposalId) });
    },
  });
}
