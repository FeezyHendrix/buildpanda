import api from "./client";
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
  stageId?: string | null;
  occurredAt?: string | null;
  materialOrderId?: string | null;
  taskId?: string | null;
  activityId?: string | null;
  fileIds?: string[];
  reason?: string | null;
  notesHtml?: string | null;
}

export interface LogEntryResult {
  entry: LedgerEntry;
  duplicate: boolean;
  negativeStock: boolean;
  onHandQty: number;
}

export const materialsLedgerApi = {
  getStock: (projectId: string) =>
    api.get<StockLevel[]>(`/projects/${projectId}/materials/stock`).then(r => r.data),
    
  getLedger: (projectId: string, filters: { materialId?: string; entryType?: LedgerEntryType }) =>
    api.get<LedgerEntry[]>(`/projects/${projectId}/materials/ledger`, { params: filters }).then(r => r.data),
    
  getCatalog: (projectId: string) =>
    api.get<MaterialCatalogItem[]>(`/projects/${projectId}/materials/catalog`).then(r => r.data),
    
  updateReorderPolicy: (projectId: string, materialId: string, input: ReorderPolicyInput) =>
    api.put<MaterialCatalogItem>(`/projects/${projectId}/materials/catalog/${materialId}/reorder-policy`, input).then(r => r.data),
    
  logEntry: (projectId: string, input: LogEntryInput) =>
    api.post<LogEntryResult>(`/projects/${projectId}/materials/ledger`, input).then(r => r.data),
    
  voidEntry: (projectId: string, entryId: string, reason?: string | null) =>
    api.post<LedgerEntry>(`/projects/${projectId}/materials/ledger/${entryId}/void`, { reason }).then(r => r.data),
    
  downloadReport: (projectId: string) =>
    api.get<Blob>(`/projects/${projectId}/materials/report`, { responseType: "blob" }),
    
  emailReport: (projectId: string, email?: string) =>
    api.post<{ sentTo: string }>(`/projects/${projectId}/materials/report/email`, email ? { email } : {}).then(r => r.data),
};
