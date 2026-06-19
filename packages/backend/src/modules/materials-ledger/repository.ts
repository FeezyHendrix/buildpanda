import type { Knex } from "knex";
import { generateId } from "../../lib/ids.ts";
import type {
  LedgerEntryFileRow,
  LedgerEntryRow,
  LedgerEntryType,
  MaterialCatalogRow,
  StockRow,
} from "./types.ts";

export interface PostEntryInput {
  id: string;
  projectId: string;
  idempotencyKey: string;
  entryType: LedgerEntryType;
  materialId: string;
  materialName: string;
  unit: string;
  locationKey: string;
  quantity: number;
  stockDelta: number;
  occurredAt: string;
  timestampSuspect: boolean;
  loggedById: string | null;
  materialOrderId: string | null;
  taskId: string | null;
  activityId: string | null;
  reversalForEntryId: string | null;
  reason: string | null;
  fileIds: string[];
  actorId: string | null;
}

export interface PostEntryResult {
  entryId: string;
  duplicate: boolean;
  negativeStock: boolean;
  onHandQty: number;
}

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

const ENTRY_SELECT = [
  "e.id",
  "e.project_id",
  "e.idempotency_key",
  "e.entry_type",
  "e.status",
  "e.material_id",
  "e.material_name_snapshot",
  "e.unit_snapshot",
  "e.location_key",
  "e.quantity",
  "e.stock_delta",
  "e.occurred_at",
  "e.timestamp_suspect",
  "e.negative_stock",
  "e.logged_by_id",
  "u.name as logged_by_name",
  "e.material_order_id",
  "e.task_id",
  "e.activity_id",
  "e.reversal_for_entry_id",
  "e.reason",
  "e.created_at",
] as const;

export function materialsLedgerRepository(db: Knex) {
  function entryBase() {
    return db("material_ledger_entries as e").leftJoin("user as u", "u.id", "e.logged_by_id");
  }

  async function findOrCreateCatalogTrx(
    trx: Knex.Transaction,
    projectId: string,
    name: string,
    unit: string,
    actorId: string | null,
  ): Promise<MaterialCatalogRow> {
    const normalized = normalize(name);
    const existing = await trx<MaterialCatalogRow>("materials_catalog")
      .where({ project_id: projectId, normalized_name: normalized, unit })
      .first();
    if (existing) return existing;
    const id = generateId("mcat");
    await trx("materials_catalog")
      .insert({
        id,
        project_id: projectId,
        name: name.trim(),
        normalized_name: normalized,
        unit,
        active: true,
        created_by_id: actorId,
      })
      .onConflict(["project_id", "normalized_name", "unit"])
      .ignore();
    const row = await trx<MaterialCatalogRow>("materials_catalog")
      .where({ project_id: projectId, normalized_name: normalized, unit })
      .first();
    if (!row) throw new Error("Failed to find-or-create catalog item");
    return row;
  }

  return {
    listCatalog(projectId: string): Promise<MaterialCatalogRow[]> {
      return db<MaterialCatalogRow>("materials_catalog")
        .where({ project_id: projectId, active: true })
        .orderBy("name", "asc");
    },

    findCatalogById(id: string): Promise<MaterialCatalogRow | undefined> {
      return db<MaterialCatalogRow>("materials_catalog").where({ id }).first();
    },

    findEntryById(id: string): Promise<LedgerEntryRow | undefined> {
      return entryBase().where("e.id", id).select(...ENTRY_SELECT).first();
    },

    async listEntries(
      projectId: string,
      filters: { materialId?: string; entryType?: LedgerEntryType; limit: number; before?: string },
    ): Promise<LedgerEntryRow[]> {
      const q = entryBase().where("e.project_id", projectId);
      if (filters.materialId) q.andWhere("e.material_id", filters.materialId);
      if (filters.entryType) q.andWhere("e.entry_type", filters.entryType);
      if (filters.before) q.andWhere("e.occurred_at", "<", filters.before);
      return q.select(...ENTRY_SELECT).orderBy("e.occurred_at", "desc").limit(filters.limit);
    },

    async listFilesForEntries(entryIds: string[]): Promise<LedgerEntryFileRow[]> {
      if (entryIds.length === 0) return [];
      return db<LedgerEntryFileRow>("material_ledger_entry_files").whereIn("entry_id", entryIds);
    },

    listStock(projectId: string): Promise<StockRow[]> {
      return db("materials_stock as s")
        .join("materials_catalog as c", "c.id", "s.material_id")
        .where("s.project_id", projectId)
        .select(
          "s.project_id",
          "s.material_id",
          "c.name as material_name",
          "c.unit",
          "s.location_key",
          "s.on_hand_qty",
          "c.low_stock_threshold",
        )
        .orderBy("c.name", "asc");
    },

    findOrCreateCatalog(
      projectId: string,
      name: string,
      unit: string,
      actorId: string | null,
    ): Promise<MaterialCatalogRow> {
      return db.transaction((trx) => findOrCreateCatalogTrx(trx, projectId, name, unit, actorId));
    },

    /**
     * Post a ledger entry and move stock in one transaction. Idempotent on
     * (project_id, idempotency_key): a duplicate key returns the existing entry
     * without moving stock again. The stock row is locked FOR UPDATE so
     * concurrent IN/USED on the same material can never lose an update.
     */
    async postEntry(input: PostEntryInput): Promise<PostEntryResult> {
      return db.transaction(async (trx) => {
        const existing = await trx<LedgerEntryRow>("material_ledger_entries")
          .where({ project_id: input.projectId, idempotency_key: input.idempotencyKey })
          .first();
        if (existing) {
          const stockRow = await trx<{ on_hand_qty: string }>("materials_stock")
            .where({ project_id: input.projectId, material_id: existing.material_id, location_key: existing.location_key })
            .first();
          return {
            entryId: existing.id,
            duplicate: true,
            negativeStock: existing.negative_stock,
            onHandQty: stockRow ? Number(stockRow.on_hand_qty) : 0,
          };
        }

        await trx("materials_stock")
          .insert({
            project_id: input.projectId,
            material_id: input.materialId,
            location_key: input.locationKey,
            on_hand_qty: 0,
          })
          .onConflict(["project_id", "material_id", "location_key"])
          .ignore();

        const locked = await trx("materials_stock")
          .where({ project_id: input.projectId, material_id: input.materialId, location_key: input.locationKey })
          .forUpdate()
          .first<{ on_hand_qty: string }>();
        const current = locked ? Number(locked.on_hand_qty) : 0;
        const nextOnHand = current + input.stockDelta;
        const negativeStock = nextOnHand < 0;

        await trx("material_ledger_entries").insert({
          id: input.id,
          project_id: input.projectId,
          idempotency_key: input.idempotencyKey,
          entry_type: input.entryType,
          status: "Posted",
          material_id: input.materialId,
          material_name_snapshot: input.materialName,
          unit_snapshot: input.unit,
          location_key: input.locationKey,
          quantity: input.quantity,
          stock_delta: input.stockDelta,
          occurred_at: input.occurredAt,
          timestamp_suspect: input.timestampSuspect,
          negative_stock: negativeStock,
          logged_by_id: input.loggedById,
          material_order_id: input.materialOrderId,
          task_id: input.taskId,
          activity_id: input.activityId,
          reversal_for_entry_id: input.reversalForEntryId,
          reason: input.reason,
        });

        await trx("materials_stock")
          .where({ project_id: input.projectId, material_id: input.materialId, location_key: input.locationKey })
          .update({ on_hand_qty: nextOnHand, last_ledger_entry_id: input.id, updated_at: trx.fn.now() });

        if (input.reversalForEntryId) {
          await trx("material_ledger_entries")
            .where({ id: input.reversalForEntryId })
            .update({ status: "Voided", updated_at: trx.fn.now() });
        }

        if (input.fileIds.length > 0) {
          await trx("material_ledger_entry_files").insert(
            input.fileIds.map((fileId) => ({ entry_id: input.id, file_id: fileId, purpose: "ProofPhoto" })),
          );
        }

        await trx("material_ledger_entry_events").insert({
          id: generateId("mlev"),
          project_id: input.projectId,
          entry_id: input.id,
          event_type: input.entryType === "VOID" ? "voided" : "created",
          actor_id: input.actorId,
          detail: JSON.stringify({ entryType: input.entryType, stockDelta: input.stockDelta }),
        });

        return { entryId: input.id, duplicate: false, negativeStock, onHandQty: nextOnHand };
      });
    },
  };
}

export type MaterialsLedgerRepository = ReturnType<typeof materialsLedgerRepository>;
