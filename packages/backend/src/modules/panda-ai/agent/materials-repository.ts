import type { Knex } from "knex";

export interface DeliveryRow {
  order_id: string;
  delivered_qty: string;
  delivered_at: string;
  delivery_note: string | null;
  rejected: boolean;
  rejected_reason: string | null;
}

export function materialsAgentRepository(db: Knex) {
  return {
    materials(projectId: string) {
      return db("material_orders as mo")
        .leftJoin("approvals as ap", "ap.id", "mo.approval_id")
        .where({ "mo.project_id": projectId })
        .orderBy("mo.created_at", "desc")
        .select(
          "mo.id",
          "ap.title as approval_title",
          "ap.status as approval_status",
          "mo.material_name",
          "mo.quantity",
          "mo.unit",
          "mo.supplier",
          "mo.status",
          "mo.needed_by",
          "mo.estimated_cost",
          "mo.currency",
        );
    },

    deliveriesForOrders(orderIds: string[]) {
      // knex renders an empty whereIn as a false predicate, so no early return.
      return db<DeliveryRow>("material_deliveries")
        .whereIn("order_id", orderIds)
        .orderBy("delivered_at", "asc")
        .select(
          "order_id",
          "delivered_qty",
          "delivered_at",
          "delivery_note",
          "rejected",
          "rejected_reason",
        );
    },

    lateMaterials(projectId: string, today: string) {
      return db("material_orders")
        .where({ project_id: projectId })
        .whereNotIn("status", ["Delivered", "Cancelled", "Rejected"])
        .where((q) =>
          q
            .where("needed_by", "<", today)
            .orWhereRaw("expected_delivery_at IS NOT NULL AND expected_delivery_at > needed_by"),
        )
        .orderBy("needed_by", "asc")
        .select(
          "id",
          "material_name",
          "quantity",
          "unit",
          "supplier",
          "status",
          "needed_by",
          "expected_delivery_at",
          "estimated_cost",
          "currency",
        );
    },

    materialStock(projectId: string) {
      const movements = db("material_ledger_entries")
        .select("material_id")
        .select(
          db.raw("COALESCE(SUM(CASE WHEN entry_type = 'IN' THEN quantity ELSE 0 END), 0) as total_received"),
        )
        .select(
          db.raw("COALESCE(SUM(CASE WHEN entry_type = 'USED' THEN quantity ELSE 0 END), 0) as total_used"),
        )
        .select(
          db.raw("COUNT(*) FILTER (WHERE status = 'Voided') as voided_count"),
        )
        .select(
          db.raw("COALESCE(SUM(CASE WHEN status = 'Voided' AND entry_type = 'IN' THEN quantity ELSE 0 END), 0) as voided_received"),
        )
        .select(
          db.raw("COALESCE(SUM(CASE WHEN status = 'Voided' AND entry_type = 'USED' THEN quantity ELSE 0 END), 0) as voided_used"),
        )
        .where({ project_id: projectId, approval_status: "Approved" })
        .groupBy("material_id");

      return db("materials_stock as s")
        .join("materials_catalog as c", "c.id", "s.material_id")
        .leftJoin(movements.as("m"), "m.material_id", "s.material_id")
        .where("s.project_id", projectId)
        .orderBy("c.name", "asc")
        .select(
          "c.name as material_name",
          "c.unit",
          "s.location_key",
          "s.on_hand_qty",
          "c.low_stock_threshold",
          db.raw("COALESCE(m.total_received, 0) - COALESCE(m.voided_received, 0) as total_received"),
          db.raw("COALESCE(m.total_used, 0) - COALESCE(m.voided_used, 0) as total_used"),
          db.raw("COALESCE(m.voided_count, 0) as voided_entry_count"),
          db.raw("COALESCE(m.voided_received, 0) as voided_received"),
          db.raw("COALESCE(m.voided_used, 0) as voided_used"),
        );
    },

    materialLedgerEntries(projectId: string, limit: number) {
      return db("material_ledger_entries as e")
        .leftJoin("user as u", "u.id", "e.logged_by_id")
        .leftJoin("user as au", "au.id", "e.approved_by_id")
        .where("e.project_id", projectId)
        .orderBy("e.occurred_at", "desc")
        .limit(limit)
        .select(
          "e.id",
          "e.entry_type",
          "e.status",
          "e.material_name_snapshot as material_name",
          "e.unit_snapshot as unit",
          "e.location_key",
          "e.quantity",
          "e.stock_delta",
          "e.occurred_at",
          "e.approval_status",
          "e.reversal_for_entry_id",
          "e.reason",
          "e.supplier",
          "e.delivery_note",
          "e.negative_stock",
          "e.timestamp_suspect",
          "e.self_approved",
          "u.name as logged_by_name",
          "au.name as approved_by_name",
        );
    },

    materialLedgerReversalsFor(entryIds: string[]) {
      if (entryIds.length === 0) {
        return Promise.resolve([] as Array<{
          reversal_for_entry_id: string;
          reason: string | null;
          occurred_at: string;
          logged_by_name: string | null;
        }>);
      }
      return db("material_ledger_entries as e")
        .leftJoin("user as u", "u.id", "e.logged_by_id")
        .where("e.entry_type", "VOID")
        .whereIn("e.reversal_for_entry_id", entryIds)
        .select<Array<{
          reversal_for_entry_id: string;
          reason: string | null;
          occurred_at: string;
          logged_by_name: string | null;
        }>>(
          "e.reversal_for_entry_id",
          "e.reason",
          "e.occurred_at",
          "u.name as logged_by_name",
        );
    },

    suppliers(projectId: string) {
      return db("suppliers")
        .where({ project_id: projectId, active: true })
        .orderBy("name", "asc")
        .select("name", "contact_name", "email", "phone", "address");
    },
  };
}
