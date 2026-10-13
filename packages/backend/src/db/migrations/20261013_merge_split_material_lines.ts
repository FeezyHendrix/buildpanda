import { randomUUID } from "node:crypto";
import type { Knex } from "knex";
import { canonicalUnit } from "../../modules/materials-ledger/units.ts";

/**
 * The catalog used to key a material on its exact unit spelling, so "50 bag"
 * in and "25 bags" used opened two stock lines: one at 50, one at -25. The
 * ledger now matches on the canonical unit; this folds the lines that were
 * already split. Each movement keeps the unit it was recorded with (the
 * ledger is a record), but points at the surviving line, and the balances
 * are added together so on hand still equals the movements behind it.
 *
 * It also back-fills the sample project's usage: its stock was seeded at 280
 * against a single 400-bag delivery, so the 120 bags used had no entry and
 * received - used never matched on hand.
 */

interface CatalogRow {
  id: string;
  project_id: string;
  normalized_name: string;
  unit: string;
  created_at: Date;
  low_stock_threshold: string | null;
  reorder_quantity: string | null;
  lead_time_days: number | null;
}

interface StockRow {
  material_id: string;
  location_key: string;
  on_hand_qty: string;
}

async function mergeSplitLines(knex: Knex): Promise<void> {
  const rows = await knex<CatalogRow>("materials_catalog").orderBy("created_at", "asc");
  const groups = new Map<string, CatalogRow[]>();
  for (const row of rows) {
    const key = `${row.project_id}\u0000${row.normalized_name}\u0000${canonicalUnit(row.unit)}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const [keeper, ...duplicates] = group as [CatalogRow, ...CatalogRow[]];
    const duplicateIds = duplicates.map((d) => d.id);

    const stock = await knex<StockRow>("materials_stock")
      .where({ project_id: keeper.project_id })
      .whereIn("material_id", [keeper.id, ...duplicateIds]);
    const totals = new Map<string, number>();
    for (const line of stock) {
      totals.set(line.location_key, (totals.get(line.location_key) ?? 0) + Number(line.on_hand_qty));
    }

    await knex("material_ledger_entries")
      .where({ project_id: keeper.project_id })
      .whereIn("material_id", duplicateIds)
      .update({ material_id: keeper.id, updated_at: knex.fn.now() });
    await knex("materials_stock").where({ project_id: keeper.project_id }).whereIn("material_id", duplicateIds).del();

    for (const [locationKey, onHand] of totals) {
      await knex("materials_stock")
        .insert({ project_id: keeper.project_id, material_id: keeper.id, location_key: locationKey, on_hand_qty: onHand })
        .onConflict(["project_id", "material_id", "location_key"])
        .merge({ on_hand_qty: onHand, updated_at: knex.fn.now() });
      // A shortfall that only existed because the line was split is not one.
      if (onHand >= 0) {
        await knex("material_ledger_entries")
          .where({ project_id: keeper.project_id, material_id: keeper.id, location_key: locationKey, negative_stock: true })
          .update({ negative_stock: false, updated_at: knex.fn.now() });
      }
    }

    // Keep any reorder policy the surviving line lacks.
    const policySource = duplicates.find((d) => d.low_stock_threshold !== null || d.reorder_quantity !== null);
    if (policySource && keeper.low_stock_threshold === null && keeper.reorder_quantity === null) {
      await knex("materials_catalog").where({ id: keeper.id }).update({
        low_stock_threshold: policySource.low_stock_threshold,
        reorder_quantity: policySource.reorder_quantity,
        lead_time_days: policySource.lead_time_days,
      });
    }
    await knex("materials_catalog").whereIn("id", duplicateIds).del();
  }
}

async function backfillSampleUsage(knex: Knex): Promise<void> {
  const deliveries = await knex("material_ledger_entries")
    .where("idempotency_key", "like", "%:sample-cement-in")
    .select("id", "project_id", "material_id", "material_name_snapshot", "unit_snapshot", "location_key", "occurred_at", "stage_id");

  for (const delivery of deliveries) {
    const key = `${delivery.project_id}:sample-cement-used`;
    const exists = await knex("material_ledger_entries").where({ project_id: delivery.project_id, idempotency_key: key }).first();
    if (exists) continue;
    // Stock already reflects the usage (it was seeded at 280); only the entry
    // that explains it is missing, so nothing on hand moves here.
    await knex("material_ledger_entries").insert({
      id: `mle_${randomUUID()}`,
      project_id: delivery.project_id,
      idempotency_key: key,
      entry_type: "USED",
      status: "Posted",
      approval_status: "Approved",
      material_id: delivery.material_id,
      material_name_snapshot: delivery.material_name_snapshot,
      unit_snapshot: delivery.unit_snapshot,
      location_key: delivery.location_key,
      quantity: 120,
      stock_delta: -120,
      occurred_at: delivery.occurred_at,
      timestamp_suspect: false,
      negative_stock: false,
      reason: "Ground-floor slab pour",
      stage_id: delivery.stage_id,
    });
  }
}

export async function up(knex: Knex): Promise<void> {
  await mergeSplitLines(knex);
  await backfillSampleUsage(knex);
}

export async function down(): Promise<void> {
  // Merged lines cannot be told apart again; the back-filled usage is a true
  // record of the sample project. Nothing to undo.
}
