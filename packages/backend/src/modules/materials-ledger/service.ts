import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { toIso } from "../../lib/dates.ts";
import type { CatalogPolicyPatch, MaterialsLedgerRepository } from "./repository.ts";
import type {
  LedgerEntry,
  LedgerEntryFileRow,
  LedgerEntryRow,
  LedgerEntryType,
  MaterialCatalogItem,
  MaterialCatalogRow,
  ReorderPolicyInput,
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
  stageId?: string | null;
  occurredAt?: string | null;
  materialOrderId?: string | null;
  taskId?: string | null;
  activityId?: string | null;
  fileIds?: string[];
  reason?: string | null;
  notesHtml?: string | null;
  idempotencyKey?: string | null;
  supplier?: string | null;
  deliveryNote?: string | null;
  /**
   * A receipt raised from a signed delivery note is already a fact, so it is
   * posted Approved. Anything typed straight into the log is a claim and stays
   * Pending until somebody accepts it.
   */
  approvalStatus?: "Pending" | "Approved";
}

export interface LogEntryResult {
  entry: LedgerEntry;
  duplicate: boolean;
  negativeStock: boolean;
  onHandQty: number;
}

/** The order a receipt is logged against, as the ledger needs it. */
export interface ReceiptOrder {
  materialName: string;
  unit: string;
  stageId: string | null;
  /** Cancelled and rejected orders take no more goods. */
  receivable: boolean;
}

export interface LedgerSideEffects {
  /** Resolves an order a receipt names; null when it is not on the project. */
  receiptOrder?: (projectId: string, orderId: string) => Promise<ReceiptOrder | null>;
  /**
   * The one open order a receipt of this material must be for, when there is
   * exactly one. With two or more the crew has to say which; none means an
   * unplanned delivery.
   */
  soleOpenOrderFor?: (projectId: string, materialName: string) => Promise<string | null>;
  /**
   * A crew receipt against an order has just been accepted: record it on the
   * order as a delivery (status, cost) without posting the stock twice.
   */
  onReceiptApproved?: (info: {
    projectId: string;
    entryId: string;
    materialOrderId: string;
    quantity: number;
    occurredAt: string;
    deliveryNote: string | null;
    actorId: string;
  }) => Promise<void>;
  onNegativeStock?: (info: {
    projectId: string;
    materialName: string;
    onHandQty: number;
    entryId: string;
    actorId: string | null;
  }) => void;
  onLowStock?: (info: {
    projectId: string;
    materialId: string;
    materialName: string;
    unit: string;
    onHandQty: number;
    lowStockThreshold: number;
    reorderQuantity: number | null;
    leadTimeDays: number | null;
    preferredSupplierId: string | null;
    autoReorderEnabled: boolean;
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
    reorderQuantity: row.reorder_quantity === null ? null : Number(row.reorder_quantity),
    leadTimeDays: row.lead_time_days,
    preferredSupplierId: row.preferred_supplier_id,
    preferredSupplierName: row.preferred_supplier_name,
    autoReorderEnabled: row.auto_reorder_enabled,
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
    totalReceived: Number(row.total_received),
    totalUsed: Number(row.total_used),
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
      stageId: row.stage_id,
      stageName: row.stage_name,
      approvalStatus: row.approval_status,
      approvedById: row.approved_by_id,
      approvedByName: row.approved_by_name,
      approvedAt: row.approved_at ? toIso(row.approved_at) : null,
      quantity: Number(row.quantity),
    stockDelta: Number(row.stock_delta),
    occurredAt: toIso(row.occurred_at),
    timestampSuspect: row.timestamp_suspect,
    negativeStock: row.negative_stock,
    loggedById: row.logged_by_id,
    loggedByName: row.logged_by_name,
    materialOrderId: row.material_order_id,
    materialOrderTitle: row.material_order_title ?? null,
    taskId: row.task_id,
    activityId: row.activity_id,
    reversalForEntryId: row.reversal_for_entry_id,
    reason: row.reason,
    notesHtml: row.notes_html,
    supplier: row.supplier,
    deliveryNote: row.delivery_note,
    selfApproved: row.self_approved,
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

  /**
   * A receipt against an order is that order's material: it takes the
   * order's name and unit so it lands on the same stock line the order
   * will, whatever the crew typed. Usage is never tied to an order.
   */
  async function againstOrder(projectId: string, raw: LogEntryInput): Promise<LogEntryInput> {
    // A receipt spoken or typed without naming its order still belongs to
    // one when only one open order is waiting for that material. Receipts
    // posted by a delivery already carry theirs.
    const input =
      raw.entryType === "IN" && !raw.materialOrderId && sideEffects.soleOpenOrderFor
        ? { ...raw, materialOrderId: await sideEffects.soleOpenOrderFor(projectId, raw.materialName) }
        : raw;
    if (!input.materialOrderId) return input;
    if (input.entryType !== "IN") return { ...input, materialOrderId: null };
    const order = await sideEffects.receiptOrder?.(projectId, input.materialOrderId);
    if (!sideEffects.receiptOrder) return input;
    if (!order) throw new BadRequestError("That material order is not on this project");
    if (!order.receivable) throw new BadRequestError("That material order is closed and cannot receive goods");
    return {
      ...input,
      materialName: order.materialName,
      unit: order.unit,
      stageId: input.stageId ?? order.stageId,
    };
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

    async updateReorderPolicy(
      projectId: string,
      materialId: string,
      input: ReorderPolicyInput,
    ): Promise<MaterialCatalogItem> {
      const existing = await repository.findCatalogById(materialId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Material");

      const patch: CatalogPolicyPatch = {};
      if (input.lowStockThreshold !== undefined) {
        patch.low_stock_threshold = input.lowStockThreshold === null ? null : String(input.lowStockThreshold);
      }
      if (input.reorderQuantity !== undefined) {
        if (input.reorderQuantity !== null && input.reorderQuantity <= 0) {
          throw new BadRequestError("Reorder quantity must be greater than zero");
        }
        patch.reorder_quantity = input.reorderQuantity === null ? null : String(input.reorderQuantity);
      }
      if (input.leadTimeDays !== undefined) {
        if (input.leadTimeDays !== null && input.leadTimeDays < 0) {
          throw new BadRequestError("Lead time must be zero or more days");
        }
        patch.lead_time_days = input.leadTimeDays;
      }
      if (input.preferredSupplierId !== undefined) patch.preferred_supplier_id = input.preferredSupplierId;
      if (input.autoReorderEnabled !== undefined) patch.auto_reorder_enabled = input.autoReorderEnabled;

      const row = await repository.updateCatalogPolicy(materialId, patch);
      if (!row) throw new NotFoundError("Material");
      return toCatalog(row);
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

    async logEntry(projectId: string, rawInput: LogEntryInput, actorId: string | null): Promise<LogEntryResult> {
      if (rawInput.quantity <= 0) throw new BadRequestError("Quantity must be greater than zero");
      const input = await againstOrder(projectId, rawInput);
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
          stageId: input.stageId ?? null,
          approvalStatus: input.approvalStatus ?? "Pending",
          supplier: input.supplier ?? null,
          deliveryNote: input.deliveryNote ?? null,
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

      const threshold = catalog.low_stock_threshold === null ? null : Number(catalog.low_stock_threshold);
      if (!result.duplicate && threshold !== null && result.onHandQty <= threshold) {
        sideEffects.onLowStock?.({
          projectId,
          materialId: catalog.id,
          materialName: catalog.name,
          unit: catalog.unit,
          onHandQty: result.onHandQty,
          lowStockThreshold: threshold,
          reorderQuantity: catalog.reorder_quantity === null ? null : Number(catalog.reorder_quantity),
          leadTimeDays: catalog.lead_time_days,
          preferredSupplierId: catalog.preferred_supplier_id,
          autoReorderEnabled: catalog.auto_reorder_enabled,
          actorId,
        });
      }

      const entry = await loadEntry(projectId, result.entryId);
      return { entry, duplicate: result.duplicate, negativeStock: result.negativeStock, onHandQty: result.onHandQty };
    },

      async approveEntry(projectId: string, entryId: string, actorId: string): Promise<LedgerEntry> {
        const before = await repository.findEntryById(entryId);
        const row = await repository.approveEntry(projectId, entryId, actorId);
        if (!row || !before) throw new NotFoundError("Ledger entry");
        const accepted = before.approval_status === "Pending" && before.status === "Posted";
        if (accepted && before.entry_type === "IN" && before.material_order_id) {
          await sideEffects.onReceiptApproved?.({
            projectId,
            entryId,
            materialOrderId: before.material_order_id,
            quantity: Number(before.quantity),
            occurredAt: toIso(before.occurred_at),
            deliveryNote: before.delivery_note,
            actorId,
          });
        }
        return loadEntry(projectId, entryId);
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
          stageId: original.stage_id,
        quantity: Number(original.quantity),
        // Reverse only what was actually applied. A pending entry never moved
        // stock, so subtracting its delta would drive the balance negative for
        // materials that were never counted.
        stockDelta:
          original.approval_status === "Approved" ? -Number(original.stock_delta) : 0,
        // The reversal is itself a deliberate act by someone with permission,
        // so it applies immediately. Born Pending, a void would never restore
        // stock until a second person approved the undo.
        approvalStatus: "Approved",
        supplier: original.supplier,
        deliveryNote: original.delivery_note,
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
