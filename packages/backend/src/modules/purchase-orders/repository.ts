import type { Knex } from "knex";
import type {
  PurchaseOrderItemRow,
  PurchaseOrderRow,
  PurchaseOrderStatus,
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
}

export interface PurchaseOrderUpdatePatch {
  po_number?: string;
  vendor_name?: string;
  status?: PurchaseOrderStatus;
  order_date?: string | null;
  expected_date?: string | null;
  notes?: string | null;
}

export interface NewPurchaseOrderItemRecord {
  id: string;
  purchase_order_id: string;
  description: string;
  quantity: string;
  unit_price: string;
}

export function purchaseOrdersRepository(db: Knex) {
  return {
    listByProject(projectId: string): Promise<PurchaseOrderRow[]> {
      return db<PurchaseOrderRow>("purchase_orders")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc");
    },

    findById(id: string): Promise<PurchaseOrderRow | undefined> {
      return db<PurchaseOrderRow>("purchase_orders").where({ id }).first();
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
