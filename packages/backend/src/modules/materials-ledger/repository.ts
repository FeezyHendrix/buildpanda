import type { Knex } from "knex";
import { generateId } from "../../lib/ids.ts";
import { ledgerWrites } from "./entry-writes.ts";
import type {
  CatalogPolicyPatch,
  LedgerEntryFileRow,
  LedgerEntryRow,
  LedgerEntryType,
  MaterialCatalogRow,
  StockRow,
} from "./types.ts";

// Re-exported so existing importers keep working; the shapes live in types.ts.
export type { CatalogPolicyPatch, PostEntryInput, PostEntryResult } from "./types.ts";

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

const CATALOG_SELECT = [
  "materials_catalog.id",
  "materials_catalog.project_id",
  "materials_catalog.name",
  "materials_catalog.normalized_name",
  "materials_catalog.unit",
  "materials_catalog.low_stock_threshold",
  "materials_catalog.active",
  "materials_catalog.created_by_id",
  "materials_catalog.created_at",
  "materials_catalog.updated_at",
  "materials_catalog.reorder_quantity",
  "materials_catalog.lead_time_days",
  "materials_catalog.preferred_supplier_id",
  "sup.name as preferred_supplier_name",
  "materials_catalog.auto_reorder_enabled",
] as const;

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
    "e.stage_id",
    "e.quantity",
  "e.stock_delta",
  "e.occurred_at",
  "e.timestamp_suspect",
  "e.negative_stock",
  "e.logged_by_id",
  "u.name as logged_by_name",
  "ph.name as stage_name",
  "e.approval_status",
  "e.approved_by_id",
  "au.name as approved_by_name",
  "e.approved_at",
  "e.material_order_id",
  "e.task_id",
  "e.activity_id",
  "e.reversal_for_entry_id",
  "e.reason",
  "e.supplier",
  "e.delivery_note",
  "e.self_approved",
  "e.created_at",
] as const;

export function materialsLedgerRepository(db: Knex) {
  function entryBase() {
    // leftJoin, not inner: stage_id is nullable, and an inner join would
    // silently drop every entry logged before a stage was chosen.
    return db("material_ledger_entries as e")
      .leftJoin("user as u", "u.id", "e.logged_by_id")
      .leftJoin("project_phases as ph", "ph.id", "e.stage_id")
      .leftJoin("user as au", "au.id", "e.approved_by_id");
  }

  function catalogBase() {
    return db("materials_catalog")
      .leftJoin("suppliers as sup", "sup.id", "materials_catalog.preferred_supplier_id")
      .select(...CATALOG_SELECT);
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
      return catalogBase().where({ "materials_catalog.project_id": projectId, "materials_catalog.active": true }).orderBy("materials_catalog.name", "asc");
    },

    findCatalogById(id: string): Promise<MaterialCatalogRow | undefined> {
      return catalogBase().where({ "materials_catalog.id": id }).first();
    },

    async updateCatalogPolicy(id: string, patch: CatalogPolicyPatch): Promise<MaterialCatalogRow | undefined> {
      const updated = await db("materials_catalog")
        .where({ id })
        .update({ ...patch, updated_at: new Date() });
      if (!updated) return undefined;
      return catalogBase().where({ "materials_catalog.id": id }).first();
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
      const agg = db("material_ledger_entries")
        .select("material_id")
        .select(
          db.raw(
            "COALESCE(SUM(CASE WHEN entry_type = 'IN' THEN quantity ELSE 0 END), 0) as total_received",
          ),
        )
        .select(
          db.raw(
            "COALESCE(SUM(CASE WHEN entry_type = 'USED' THEN quantity ELSE 0 END), 0) as total_used",
          ),
        )
          // Received/used totals count accepted movements only, matching
          // on_hand_qty, which approve() is the only thing that moves.
          .where({ project_id: projectId, approval_status: "Approved" })
          .groupBy("material_id");

      return db("materials_stock as s")
        .join("materials_catalog as c", "c.id", "s.material_id")
        .leftJoin(agg.as("agg"), "agg.material_id", "s.material_id")
        .where("s.project_id", projectId)
        .select(
          "s.project_id",
          "s.material_id",
          "c.name as material_name",
          "c.unit",
          "s.location_key",
          "s.on_hand_qty",
          "c.low_stock_threshold",
          db.raw("COALESCE(agg.total_received, 0) as total_received"),
          db.raw("COALESCE(agg.total_used, 0) as total_used"),
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

    // The two stock-moving writes live in entry-writes.ts, where the
    // transaction and the FOR UPDATE lock that guard the ledger's invariants
    // are kept together.
    ...ledgerWrites(db),
  };
}

export type MaterialsLedgerRepository = ReturnType<typeof materialsLedgerRepository>;
