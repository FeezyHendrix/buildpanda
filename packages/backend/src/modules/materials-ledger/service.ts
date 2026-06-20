import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { toIso } from "../../lib/dates.ts";
import type { MaterialsLedgerRepository } from "./repository.ts";
import type {
  LedgerEntry,
  LedgerEntryFileRow,
  LedgerEntryRow,
  LedgerEntryType,
  MaterialCatalogItem,
  MaterialCatalogRow,
  StockLevel,
  StockRow,
} from "./types.ts";

const FUTURE_SKEW_MS = 15 * 60 * 1000;
const PAST_SKEW_MS = 90 * 24 * 60 * 60 * 1000;

export interface LogEntryInput {
  entryType: Exclude<LedgerEntryType, "VOID">;
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

export interface LogEntryResult {
  entry: LedgerEntry;
  duplicate: boolean;
  negativeStock: boolean;
  onHandQty: number;
}

export interface LedgerSideEffects {
  onNegativeStock?: (info: {
    projectId: string;
    materialName: string;
    onHandQty: number;
    entryId: string;
    actorId: string | null;
  }) => void;
}

function fileUrl(fileId: string): string {
  return `/files/${fileId}/download`;
}

function isTimestampSuspect(occurredAt: string, now: number): boolean {
  const t = new Date(occurredAt).getTime();
  if (Number.isNaN(t)) return true;
  return t > now + FUTURE_SKEW_MS || t < now - PAST_SKEW_MS;
}

function toCatalog(row: MaterialCatalogRow): MaterialCatalogItem {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    unit: row.unit,
    lowStockThreshold: row.low_stock_threshold === null ? null : Number(row.low_stock_threshold),
    active: row.active,
  };
}

function toStock(row: StockRow): StockLevel {
  const onHand = Number(row.on_hand_qty);
  const threshold = row.low_stock_threshold === null ? null : Number(row.low_stock_threshold);
  return {
    materialId: row.material_id,
    materialName: row.material_name,
    unit: row.unit,
    locationKey: row.location_key,
    onHandQty: onHand,
    lowStockThreshold: threshold,
    lowStock: threshold !== null && onHand <= threshold,
  };
}

function buildEntry(row: LedgerEntryRow, files: LedgerEntryFileRow[]): LedgerEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    entryType: row.entry_type,
    status: row.status,
    materialId: row.material_id,
    materialName: row.material_name_snapshot,
    unit: row.unit_snapshot,
    locationKey: row.location_key,
    quantity: Number(row.quantity),
    stockDelta: Number(row.stock_delta),
    occurredAt: toIso(row.occurred_at),
    timestampSuspect: row.timestamp_suspect,
    negativeStock: row.negative_stock,
    loggedById: row.logged_by_id,
    loggedByName: row.logged_by_name,
    materialOrderId: row.material_order_id,
    taskId: row.task_id,
    activityId: row.activity_id,
    reversalForEntryId: row.reversal_for_entry_id,
    reason: row.reason,
    notesHtml: row.notes_html,
    files: files
      .filter((f) => f.entry_id === row.id)
      .map((f) => ({ fileId: f.file_id, url: fileUrl(f.file_id), name: f.file_id })),
    createdAt: toIso(row.created_at),
  };
}

export function materialsLedgerService(
  repository: MaterialsLedgerRepository,
  sideEffects: LedgerSideEffects = {},
) {
  async function loadEntry(projectId: string, entryId: string): Promise<LedgerEntry> {
    const row = await repository.findEntryById(entryId);
    if (!row || row.project_id !== projectId) throw new NotFoundError("Ledger entry");
    const files = await repository.listFilesForEntries([entryId]);
    return buildEntry(row, files);
  }

  return {
    async getStock(projectId: string): Promise<StockLevel[]> {
      const rows = await repository.listStock(projectId);
      return rows.map(toStock);
    },

    async getCatalog(projectId: string): Promise<MaterialCatalogItem[]> {
      const rows = await repository.listCatalog(projectId);
      return rows.map(toCatalog);
    },

    async listLedger(
      projectId: string,
      filters: { materialId?: string; entryType?: LedgerEntryType; limit?: number; before?: string },
    ): Promise<LedgerEntry[]> {
      const rows = await repository.listEntries(projectId, {
        materialId: filters.materialId,
        entryType: filters.entryType,
        before: filters.before,
        limit: Math.min(filters.limit ?? 50, 200),
      });
      const files = await repository.listFilesForEntries(rows.map((r) => r.id));
      return rows.map((row) => buildEntry(row, files));
    },

    async logEntry(projectId: string, input: LogEntryInput, actorId: string | null): Promise<LogEntryResult> {
      if (input.quantity <= 0) throw new BadRequestError("Quantity must be greater than zero");
      const unit = (input.unit || "item").trim();
      const catalog = await repository.findOrCreateCatalog(projectId, input.materialName, unit, actorId);

      const now = Date.now();
      const occurredAt = input.occurredAt ?? new Date(now).toISOString();
      const stockDelta = input.entryType === "IN" ? input.quantity : -input.quantity;

      const result = await repository.postEntry({
        id: generateId("mle"),
        projectId,
        idempotencyKey: input.idempotencyKey ?? generateId("mleidem"),
        entryType: input.entryType,
        materialId: catalog.id,
        materialName: catalog.name,
        unit: catalog.unit,
        locationKey: (input.locationKey || "default").trim(),
        quantity: input.quantity,
        stockDelta,
        occurredAt,
        timestampSuspect: isTimestampSuspect(occurredAt, now),
        loggedById: actorId,
        materialOrderId: input.materialOrderId ?? null,
        taskId: input.taskId ?? null,
        activityId: input.activityId ?? null,
        reversalForEntryId: null,
        reason: input.reason ?? null,
        notesHtml: input.notesHtml ?? null,
        fileIds: input.fileIds ?? [],
        actorId,
      });

      if (!result.duplicate && result.negativeStock) {
        sideEffects.onNegativeStock?.({
          projectId,
          materialName: catalog.name,
          onHandQty: result.onHandQty,
          entryId: result.entryId,
          actorId,
        });
      }

      const entry = await loadEntry(projectId, result.entryId);
      return { entry, duplicate: result.duplicate, negativeStock: result.negativeStock, onHandQty: result.onHandQty };
    },

    async voidEntry(projectId: string, entryId: string, reason: string | null, actorId: string | null): Promise<LedgerEntry> {
      const original = await repository.findEntryById(entryId);
      if (!original || original.project_id !== projectId) throw new NotFoundError("Ledger entry");
      if (original.entry_type === "VOID") throw new BadRequestError("A void entry cannot itself be voided");
      if (original.status === "Voided") throw new BadRequestError("This entry has already been voided");

      const reversal = await repository.postEntry({
        id: generateId("mle"),
        projectId,
        idempotencyKey: generateId("mleidem"),
        entryType: "VOID",
        materialId: original.material_id,
        materialName: original.material_name_snapshot,
        unit: original.unit_snapshot,
        locationKey: original.location_key,
        quantity: Number(original.quantity),
        stockDelta: -Number(original.stock_delta),
        occurredAt: new Date().toISOString(),
        timestampSuspect: false,
        loggedById: actorId,
        materialOrderId: null,
        taskId: null,
        activityId: null,
        reversalForEntryId: entryId,
        reason,
        notesHtml: null,
        fileIds: [],
        actorId,
      });

      return loadEntry(projectId, reversal.entryId);
    },
  };
}

export type MaterialsLedgerService = ReturnType<typeof materialsLedgerService>;
