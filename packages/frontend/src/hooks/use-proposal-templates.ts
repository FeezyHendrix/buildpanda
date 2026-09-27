import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proposalTemplatesApi, type CreateFromTemplateInput } from "@/api/proposal-templates";
import { proposalKeys, proposalTemplateKeys } from "@/hooks/query-keys";

export function useProposalTemplates() {
  return useQuery({ queryKey: proposalTemplateKeys.list(), queryFn: () => proposalTemplatesApi.list() });
}

export function useSaveProposalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ proposalId, name }: { proposalId: string; name: string }) =>
      proposalTemplatesApi.saveFromProposal(proposalId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: proposalTemplateKeys.all }),
  });
}

export function useRenameProposalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, name }: { templateId: string; name: string }) =>
      proposalTemplatesApi.rename(templateId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: proposalTemplateKeys.all }),
  });
}

export function useDeleteProposalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => proposalTemplatesApi.remove(templateId),
    onSuccess: () => qc.invalidateQueries({ queryKey: proposalTemplateKeys.all }),
  });
}

export function useCreateProposalFromTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFromTemplateInput) => proposalTemplatesApi.createProposal(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: proposalKeys.all }),
  });
}
