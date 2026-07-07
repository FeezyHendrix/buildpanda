import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { materialsLedgerApi, type LogEntryInput } from "@/api/materials-ledger";
import { materialLedgerKeys } from "./query-keys";
import type {
  LedgerEntryType,
  ReorderPolicyInput,
} from "@/lib/project-types";

export function useMaterialStock(projectId: string) {
  return useQuery({
    queryKey: materialLedgerKeys.stock(projectId),
    queryFn: () => materialsLedgerApi.getStock(projectId),
    enabled: Boolean(projectId),
  });
}

export function useMaterialLedger(
  projectId: string,
  filters: { materialId?: string; entryType?: LedgerEntryType } = {},
) {
  return useQuery({
    queryKey: materialLedgerKeys.ledger(projectId, filters.materialId, filters.entryType),
    queryFn: () => materialsLedgerApi.getLedger(projectId, filters),
    enabled: Boolean(projectId),
  });
}

export function useMaterialCatalog(projectId: string) {
  return useQuery({
    queryKey: materialLedgerKeys.catalog(projectId),
    queryFn: () => materialsLedgerApi.getCatalog(projectId),
    enabled: Boolean(projectId),
  });
}

export function useUpdateReorderPolicy(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ materialId, ...input }: ReorderPolicyInput & { materialId: string }) => materialsLedgerApi.updateReorderPolicy(projectId, materialId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: materialLedgerKeys.all(projectId) }),
  });
}

export function useLogMaterialEntry(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LogEntryInput) => materialsLedgerApi.logEntry(projectId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: materialLedgerKeys.all(projectId) }),
  });
}

export function useVoidMaterialEntry(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, reason }: { entryId: string; reason?: string | null }) => materialsLedgerApi.voidEntry(projectId, entryId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: materialLedgerKeys.all(projectId) }),
  });
}

export function useDownloadMaterialReport(projectId: string) {
  return useMutation({
    mutationFn: async () => {
      const response = await materialsLedgerApi.downloadReport(projectId);
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `material-report.pdf`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
  });
}

export function useEmailMaterialReport(projectId: string) {
  return useMutation({
    mutationFn: (email?: string) => materialsLedgerApi.emailReport(projectId, email),
  });
}
