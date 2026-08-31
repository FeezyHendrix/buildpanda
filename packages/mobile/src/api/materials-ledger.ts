import { request } from "./client";

export type MaterialLedgerEntryType = "IN" | "USED";

export interface LogMaterialEntryInput {
  entryType: MaterialLedgerEntryType;
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
  idempotencyKey?: string | null;
}

export const materialsLedgerApi = {
  logEntry: (projectId: string, body: LogMaterialEntryInput) =>
    request<{ entry: { id: string }; duplicate: boolean; negativeStock: boolean; onHandQty: number }>(
      `/projects/${projectId}/materials/ledger`,
      { method: "POST", body: JSON.stringify(body) },
    ),
};
