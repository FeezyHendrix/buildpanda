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
  status: PurchaseOrderStatus;
  order_date: string | null;
  expected_date: string | null;
  notes: string | null;
  stage_id: string | null;
}

export interface PurchaseOrderUpdatePatch {
  po_number?: string;
  vendor_name?: string;
  status?: PurchaseOrderStatus;
  order_date?: string | null;
  expected_date?: string | null;
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

    async deletePurchaseOrder(id: string): Promise<number> {
      return db("purchase_orders").where({ id }).delete();
    },
  };
}

export type PurchaseOrdersRepository = ReturnType<typeof purchaseOrdersRepository>;
