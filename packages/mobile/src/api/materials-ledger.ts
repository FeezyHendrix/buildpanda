import { request } from "./client";

export type MaterialLedgerEntryType = "IN" | "USED";

export interface LogMaterialEntryInput {
  entryType: MaterialLedgerEntryType;
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
  idempotencyKey?: string | null;
}

/** One movement in the project's material ledger, as the server lists it. */
export interface MaterialLedgerEntry {
  id: string;
  entryType: string;
  status: string;
  materialName: string;
  unit: string;
  stageId: string | null;
  stageName: string | null;
  approvalStatus: string;
  quantity: number;
  occurredAt: string;
  negativeStock: boolean;
  loggedByName: string | null;
  reason: string | null;
  notesHtml: string | null;
  materialOrderId: string | null;
  /** The order a receipt arrived against; none is an unplanned delivery. */
  materialOrderTitle: string | null;
}

/** Received minus used for one material at one location. */
export interface MaterialStockLevel {
  materialId: string;
  materialName: string;
  unit: string;
  locationKey: string;
  onHandQty: number;
  lowStock: boolean;
}

export interface MaterialCatalogItem {
  name: string;
  unit: string;
  active: boolean;
}

export const materialsLedgerApi = {
  list: (projectId: string) =>
    request<MaterialLedgerEntry[]>(`/projects/${projectId}/materials/ledger`),

  stock: (projectId: string) =>
    request<MaterialStockLevel[]>(`/projects/${projectId}/materials/stock`),

  catalog: (projectId: string) =>
    request<MaterialCatalogItem[]>(`/projects/${projectId}/materials/catalog`),

  logEntry: (projectId: string, body: LogMaterialEntryInput) =>
      request<{
        entry: MaterialLedgerEntry;
        duplicate: boolean;
        negativeStock: boolean;
        onHandQty: number;
      }>(
      `/projects/${projectId}/materials/ledger`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  voidEntry: (projectId: string, entryId: string, reason: string) =>
    request<{ id: string }>(`/projects/${projectId}/materials/ledger/${entryId}/void`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};
