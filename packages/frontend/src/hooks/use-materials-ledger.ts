import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { materialLedgerKeys } from "./query-keys";
import type {
  LedgerEntry,
  LedgerEntryType,
  MaterialCatalogItem,
  ReorderPolicyInput,
  StockLevel,
} from "@/lib/project-types";

export interface LogEntryInput {
  entryType: "IN" | "USED";
  materialName: string;
  unit: string;
  quantity: number;
  locationKey?: string | null;
  occurredAt?: string | null;
  materialOrderId?: string | null;
  taskId?: string | null;
  activityId?: string | null;
  fileIds?: string[];
  reason?: string | null;
  notesHtml?: string | null;
}

interface LogEntryResult {
  entry: LedgerEntry;
  duplicate: boolean;
  negativeStock: boolean;
  onHandQty: number;
}

export function useMaterialStock(projectId: string) {
  return useQuery({
    queryKey: materialLedgerKeys.stock(projectId),
    queryFn: async () => {
      const { data } = await api.get<StockLevel[]>(`/projects/${projectId}/materials/stock`);
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useMaterialLedger(
  projectId: string,
  filters: { materialId?: string; entryType?: LedgerEntryType } = {},
) {
  return useQuery({
    queryKey: materialLedgerKeys.ledger(projectId, filters.materialId, filters.entryType),
    queryFn: async () => {
      const { data } = await api.get<LedgerEntry[]>(`/projects/${projectId}/materials/ledger`, {
        params: filters,
      });
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useMaterialCatalog(projectId: string) {
  return useQuery({
    queryKey: materialLedgerKeys.catalog(projectId),
    queryFn: async () => {
      const { data } = await api.get<MaterialCatalogItem[]>(`/projects/${projectId}/materials/catalog`);
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useUpdateReorderPolicy(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ materialId, ...input }: ReorderPolicyInput & { materialId: string }) => {
      const { data } = await api.put<MaterialCatalogItem>(
        `/projects/${projectId}/materials/catalog/${materialId}/reorder-policy`,
        input,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: materialLedgerKeys.all(projectId) }),
  });
}

export function useLogMaterialEntry(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LogEntryInput) => {
      const { data } = await api.post<LogEntryResult>(`/projects/${projectId}/materials/ledger`, input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: materialLedgerKeys.all(projectId) }),
  });
}

export function useVoidMaterialEntry(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, reason }: { entryId: string; reason?: string | null }) => {
      const { data } = await api.post<LedgerEntry>(
        `/projects/${projectId}/materials/ledger/${entryId}/void`,
        { reason },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: materialLedgerKeys.all(projectId) }),
  });
}

export function useDownloadMaterialReport(projectId: string) {
  return useMutation({
    mutationFn: async () => {
      const response = await api.get<Blob>(`/projects/${projectId}/materials/report`, {
        responseType: "blob",
      });
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
    mutationFn: async (email?: string) => {
      const { data } = await api.post<{ sentTo: string }>(
        `/projects/${projectId}/materials/report/email`,
        email ? { email } : {},
      );
      return data;
    },
  });
}
