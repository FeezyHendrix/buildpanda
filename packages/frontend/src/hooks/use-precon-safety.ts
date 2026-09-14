import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  preconSafetyApi,
  type MethodStatementInput,
  type PhasePlanInput,
  type RiskInput,
} from "@/api/precon-safety";
import { preconSafetyKeys } from "@/hooks/query-keys";

function useInvalidate(key: readonly unknown[]) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: key });
}

// ---- risk register ----
export function useProposalRisks(proposalId: string) {
  return useQuery({
    queryKey: preconSafetyKeys.risks(proposalId),
    queryFn: () => preconSafetyApi.listRisks(proposalId),
    enabled: Boolean(proposalId),
  });
}

export function useCreateProposalRisk(proposalId: string) {
  const invalidate = useInvalidate(preconSafetyKeys.risks(proposalId));
  return useMutation({
    mutationFn: (body: RiskInput & { title: string; description: string }) => preconSafetyApi.createRisk(proposalId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateProposalRisk(proposalId: string) {
  const invalidate = useInvalidate(preconSafetyKeys.risks(proposalId));
  return useMutation({
    mutationFn: ({ riskId, body }: { riskId: string; body: RiskInput }) =>
      preconSafetyApi.updateRisk(proposalId, riskId, body),
    onSuccess: invalidate,
  });
}

export function useConfirmProposalRisk(proposalId: string) {
  const invalidate = useInvalidate(preconSafetyKeys.risks(proposalId));
  return useMutation({ mutationFn: (riskId: string) => preconSafetyApi.confirmRisk(proposalId, riskId), onSuccess: invalidate });
}

export function useDeleteProposalRisk(proposalId: string) {
  const invalidate = useInvalidate(preconSafetyKeys.risks(proposalId));
  return useMutation({ mutationFn: (riskId: string) => preconSafetyApi.deleteRisk(proposalId, riskId), onSuccess: invalidate });
}

export function useDraftProposalRisks(proposalId: string) {
  const invalidate = useInvalidate(preconSafetyKeys.risks(proposalId));
  return useMutation({ mutationFn: () => preconSafetyApi.draftRisks(proposalId), onSuccess: invalidate });
}

// ---- method statements ----
export function useMethodStatements(proposalId: string) {
  return useQuery({
    queryKey: preconSafetyKeys.statements(proposalId),
    queryFn: () => preconSafetyApi.listStatements(proposalId),
    enabled: Boolean(proposalId),
  });
}

export function useCreateMethodStatement(proposalId: string) {
  const invalidate = useInvalidate(preconSafetyKeys.statements(proposalId));
  return useMutation({
    mutationFn: (body: MethodStatementInput & { activityName: string }) => preconSafetyApi.createStatement(proposalId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateMethodStatement(proposalId: string) {
  const invalidate = useInvalidate(preconSafetyKeys.statements(proposalId));
  return useMutation({
    mutationFn: ({ statementId, body }: { statementId: string; body: MethodStatementInput }) =>
      preconSafetyApi.updateStatement(proposalId, statementId, body),
    onSuccess: invalidate,
  });
}

export function useConfirmMethodStatement(proposalId: string) {
  const invalidate = useInvalidate(preconSafetyKeys.statements(proposalId));
  return useMutation({
    mutationFn: (statementId: string) => preconSafetyApi.confirmStatement(proposalId, statementId),
    onSuccess: invalidate,
  });
}

export function useDeleteMethodStatement(proposalId: string) {
  const invalidate = useInvalidate(preconSafetyKeys.statements(proposalId));
  return useMutation({
    mutationFn: (statementId: string) => preconSafetyApi.deleteStatement(proposalId, statementId),
    onSuccess: invalidate,
  });
}

export function useDraftMethodStatements(proposalId: string) {
  const invalidate = useInvalidate(preconSafetyKeys.statements(proposalId));
  return useMutation({ mutationFn: () => preconSafetyApi.draftStatements(proposalId), onSuccess: invalidate });
}

// ---- construction phase plan ----
export function usePhasePlan(proposalId: string) {
  return useQuery({
    queryKey: preconSafetyKeys.phasePlan(proposalId),
    queryFn: () => preconSafetyApi.phasePlan(proposalId),
    enabled: Boolean(proposalId),
  });
}

export function useSavePhasePlan(proposalId: string) {
  const invalidate = useInvalidate(preconSafetyKeys.phasePlan(proposalId));
  return useMutation({ mutationFn: (body: PhasePlanInput) => preconSafetyApi.savePhasePlan(proposalId, body), onSuccess: invalidate });
}

export function useConfirmPhasePlan(proposalId: string) {
  const invalidate = useInvalidate(preconSafetyKeys.phasePlan(proposalId));
  return useMutation({ mutationFn: () => preconSafetyApi.confirmPhasePlan(proposalId), onSuccess: invalidate });
}

export function useDraftPhasePlan(proposalId: string) {
  const invalidate = useInvalidate(preconSafetyKeys.phasePlan(proposalId));
  return useMutation({ mutationFn: () => preconSafetyApi.draftPhasePlan(proposalId), onSuccess: invalidate });
}
