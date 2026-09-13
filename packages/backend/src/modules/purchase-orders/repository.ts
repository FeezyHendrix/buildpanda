import type { Knex } from "knex";
import {
  COMMITTED_PURCHASE_ORDER_STATUSES,
  type PurchaseOrderItemRow,
  type PurchaseOrderRow,
  type PurchaseOrderRowWithStage,
  type PurchaseOrderStatus,
  type StageCommittedSumRow,
} from "./types.ts";

export interface NewPurchaseOrderRecord {
  id: string;
  project_id: string;
  po_number: string;
  vendor_name: string;
  supplier_id: string | null;
  material_order_id: string | null;
  status: PurchaseOrderStatus;
  order_date: string | null;
  expected_date: string | null;
  notes: string | null;
  stage_id: string | null;
}

export interface PurchaseOrderUpdatePatch {
  po_number?: string;
  vendor_name?: string;
  supplier_id?: string | null;
  status?: PurchaseOrderStatus;
  order_date?: string | null;
  expected_date?: string | null;
  issued_at?: string | null;
  issued_by_id?: string | null;
  cancel_reason?: string | null;
  cancelled_at?: string | null;
  closed_at?: string | null;
  over_receipt?: boolean;
  notes?: string | null;
  stage_id?: string | null;
}

export interface NewPurchaseOrderItemRecord {
  id: string;
  purchase_order_id: string;
  description: string;
  quantity: string;
  unit_price: string;
}

function withStage(db: Knex) {
  return db<PurchaseOrderRow>("purchase_orders")
    .select("purchase_orders.*", "project_phases.name as stage_name")
    .leftJoin("project_phases", "project_phases.id", "purchase_orders.stage_id");
}

export function purchaseOrdersRepository(db: Knex) {
  return {
    listByProject(projectId: string): Promise<PurchaseOrderRowWithStage[]> {
      return withStage(db)
        .where("purchase_orders.project_id", projectId)
        .orderBy("purchase_orders.created_at", "desc") as unknown as Promise<PurchaseOrderRowWithStage[]>;
    },

    findById(id: string): Promise<PurchaseOrderRowWithStage | undefined> {
      return withStage(db)
        .where("purchase_orders.id", id)
        .first() as unknown as Promise<PurchaseOrderRowWithStage | undefined>;
    },

    findByNumber(projectId: string, poNumber: string): Promise<PurchaseOrderRow | undefined> {
      return db<PurchaseOrderRow>("purchase_orders")
        .where({ project_id: projectId, po_number: poNumber })
        .first();
    },

    /** Every PO number already used on the project, for allocating the next. */
    async listNumbers(projectId: string): Promise<string[]> {
      const rows = await db("purchase_orders").where({ project_id: projectId }).select("po_number");
      return (rows as Array<{ po_number: string }>).map((r) => r.po_number);
    },

    // Money committed to suppliers per stage: only POs that have actually been
    // issued count, and a cancelled or draft order commits nothing.
    committedByStage(projectId: string): Promise<StageCommittedSumRow[]> {
      return db("purchase_orders as po")
        .join("purchase_order_items as it", "it.purchase_order_id", "po.id")
        .where("po.project_id", projectId)
        .whereNotNull("po.stage_id")
        .whereIn("po.status", [...COMMITTED_PURCHASE_ORDER_STATUSES])
        .groupBy("po.stage_id")
        .select("po.stage_id")
        .sum({ total: db.raw("it.quantity * it.unit_price") }) as unknown as Promise<StageCommittedSumRow[]>;
    },

    listItemsForPurchaseOrders(purchaseOrderIds: string[]): Promise<PurchaseOrderItemRow[]> {
      if (purchaseOrderIds.length === 0) return Promise.resolve([]);
      return db<PurchaseOrderItemRow>("purchase_order_items")
        .whereIn("purchase_order_id", purchaseOrderIds)
        .orderBy("created_at", "asc");
    },

    async create(
      record: NewPurchaseOrderRecord,
      items: NewPurchaseOrderItemRecord[],
    ): Promise<PurchaseOrderRow> {
      return db.transaction(async (trx) => {
        const [row] = await trx<PurchaseOrderRow>("purchase_orders")
          .insert(record)
          .returning("*");
        if (!row) throw new Error("Failed to insert purchase order");
        if (items.length > 0) await trx("purchase_order_items").insert(items);
        return row;
      });
    },

    async update(
      id: string,
      patch: PurchaseOrderUpdatePatch,
      items: NewPurchaseOrderItemRecord[],
    ): Promise<PurchaseOrderRow | undefined> {
      return db.transaction(async (trx) => {
        const [row] = await trx<PurchaseOrderRow>("purchase_orders")
          .where({ id })
          .update(patch)
          .returning("*");
        if (!row) return undefined;
        await trx("purchase_order_items").where({ purchase_order_id: id }).delete();
        if (items.length > 0) await trx("purchase_order_items").insert(items);
        return row;
      });
    },

    /** Status-only move: the lines are untouched, which is the point of an action. */
    async transition(id: string, patch: PurchaseOrderUpdatePatch): Promise<PurchaseOrderRow | undefined> {
      const [row] = await db<PurchaseOrderRow>("purchase_orders")
        .where({ id })
        .update(patch)
        .returning("*");
      return row;
    },

    /** Receipt quantities and the resulting status, applied together. */
    async applyReceipt(
      id: string,
      received: Array<{ itemId: string; receivedQuantity: number }>,
      patch: PurchaseOrderUpdatePatch,
    ): Promise<PurchaseOrderRow | undefined> {
      return db.transaction(async (trx) => {
        for (const line of received) {
          await trx("purchase_order_items")
            .where({ id: line.itemId, purchase_order_id: id })
            .update({ received_quantity: String(line.receivedQuantity) });
        }
        const [row] = await trx<PurchaseOrderRow>("purchase_orders")
          .where({ id })
          .update(patch)
          .returning("*");
        return row;
      });
    },

    async deletePurchaseOrder(id: string): Promise<number> {
      return db("purchase_orders").where({ id }).delete();
    },
  };
}

export type PurchaseOrdersRepository = ReturnType<typeof purchaseOrdersRepository>;
