import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { complianceDocsApi, type CreateComplianceDocInput, type UpdateComplianceDocInput } from "@/api/compliance-docs";
import { complianceDocKeys } from "@/hooks/query-keys";

export function useComplianceDocs() {
  return useQuery({ queryKey: complianceDocKeys.list(), queryFn: () => complianceDocsApi.list() });
}

export function useCreateComplianceDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateComplianceDocInput) => complianceDocsApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: complianceDocKeys.all }),
  });
}

export function useUpdateComplianceDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, body }: { docId: string; body: UpdateComplianceDocInput }) => complianceDocsApi.update(docId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: complianceDocKeys.all }),
  });
}

export function useDeleteComplianceDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => complianceDocsApi.remove(docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: complianceDocKeys.all }),
  });
}
