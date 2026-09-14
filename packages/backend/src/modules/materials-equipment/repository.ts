import type { Knex } from "knex";
import type { CurrencyCode } from "../../lib/currencies.ts";
import type {
  EquipmentBucket,
  EquipmentHireExtension,
  EquipmentRequestRow,
  EquipmentRequestStatus,
  MaterialDeliveryRow,
  MaterialOrderRow,
  MaterialOrderStatus,
  RequestPriority,
} from "./types.ts";

export interface NewMaterialOrderRecord {
  id: string;
  project_id: string;
  title: string;
  material_name: string;
  quantity: string;
  unit: string;
  supplier: string | null;
  supplier_id: string | null;
  status: MaterialOrderStatus;
  priority: RequestPriority;
  phase_id: string | null;
  activity_id: string | null;
  document_id: string | null;
  requested_by_id: string | null;
  needed_by: string;
  ordered_at: string | null;
  expected_delivery_at: string | null;
  delivered_at: string | null;
  unit_rate: string | null;
  estimated_cost: string;
  actual_cost: string;
  currency: CurrencyCode;
  delivery_location: string | null;
  notes: string | null;
  cancel_reason: string | null;
  rejected_reason: string | null;
  invoice_id: string | null;
  invoice_line_item_id: string | null;
}

export type MaterialOrderPatch = Partial<Omit<NewMaterialOrderRecord, "id" | "project_id" | "requested_by_id">> & {
  updated_at?: Date;
};

export interface NewEquipmentRequestRecord {
  id: string;
  project_id: string;
  title: string;
  equipment_name: string;
  equipment_type: string;
  quantity: number;
  supplier: string | null;
  supplier_id: string | null;
  status: EquipmentRequestStatus;
  priority: RequestPriority;
  phase_id: string | null;
  activity_id: string | null;
  document_id: string | null;
  requested_by_id: string | null;
  needed_from: string;
  needed_until: string;
  mobilized_at: string | null;
  returned_at: string | null;
  on_hire_at: string | null;
  off_hire_at: string | null;
  plant_ref: string | null;
  daily_rate: string | null;
  extensions: string;
  estimated_cost: string;
  actual_cost: string;
  currency: CurrencyCode;
  delivery_location: string | null;
  operator_required: string;
  notes: string | null;
  cancel_reason: string | null;
  rejected_reason: string | null;
}

export type EquipmentRequestPatch = Partial<Omit<NewEquipmentRequestRecord, "id" | "project_id" | "requested_by_id">> & {
  updated_at?: Date;
};

export interface NewMaterialDeliveryRecord {
  id: string;
  project_id: string;
  order_id: string;
  delivered_qty: string;
  delivered_at: string;
  delivery_note: string | null;
  received_by_id: string | null;
  notes: string | null;
  rejected: boolean;
  rejected_reason: string | null;
  created_by_id: string | null;
}

const MATERIAL_SELECT = [
  "mo.id",
  "mo.project_id",
  "mo.title",
  "mo.material_name",
  "mo.quantity",
  "mo.unit",
  "mo.supplier",
  "mo.supplier_id",
  "sup.name as supplier_name",
  "mo.status",
  "mo.priority",
  "mo.phase_id",
  "pp.name as phase_name",
  "mo.activity_id",
  "a.name as activity_name",
  "mo.document_id",
  "pd.file_name as document_name",
  "mo.requested_by_id",
  "mo.needed_by",
  "mo.ordered_at",
  "mo.expected_delivery_at",
  "mo.delivered_at",
  "mo.unit_rate",
  "mo.estimated_cost",
  "mo.actual_cost",
  "mo.currency",
  "mo.delivery_location",
  "mo.notes",
  "mo.cancel_reason",
  "mo.rejected_reason",
  "mp.id as procurement_id",
  "mo.created_at",
  "mo.updated_at",
] as const;

const EQUIPMENT_SELECT = [
  "er.id",
  "er.project_id",
  "er.title",
  "er.equipment_name",
  "er.equipment_type",
  "er.quantity",
  "er.supplier",
  "er.supplier_id",
  "sup.name as supplier_name",
  "er.status",
  "er.priority",
  "er.phase_id",
  "pp.name as phase_name",
  "er.activity_id",
  "a.name as activity_name",
  "er.document_id",
  "pd.file_name as document_name",
  "er.requested_by_id",
  "er.needed_from",
  "er.needed_until",
  "er.mobilized_at",
  "er.returned_at",
  "er.on_hire_at",
  "er.off_hire_at",
  "er.plant_ref",
  "er.daily_rate",
  "er.extensions",
  "er.estimated_cost",
  "er.actual_cost",
  "er.currency",
  "er.delivery_location",
  "er.operator_required",
  "er.notes",
  "er.cancel_reason",
  "er.rejected_reason",
  "er.created_at",
  "er.updated_at",
] as const;

const DELIVERY_SELECT = [
  "d.id",
  "d.project_id",
  "d.order_id",
  "d.delivered_qty",
  "d.delivered_at",
  "d.delivery_note",
  "d.received_by_id",
  "u.name as received_by_name",
  "d.notes",
  "d.rejected",
  "d.rejected_reason",
  "d.ledger_entry_id",
  "d.transaction_id",
  "d.created_by_id",
  "d.created_at",
] as const;

export function materialsEquipmentRepository(db: Knex) {
  function materialBase() {
    return db("material_orders as mo")
      .leftJoin("project_phases as pp", "pp.id", "mo.phase_id")
      .leftJoin("activities as a", "a.id", "mo.activity_id")
      .leftJoin("project_documents as pd", "pd.id", "mo.document_id")
      .leftJoin("suppliers as sup", "sup.id", "mo.supplier_id")
      .leftJoin("material_procurements as mp", "mp.material_order_id", "mo.id");
  }

  function equipmentBase() {
    return db("equipment_requests as er")
      .leftJoin("project_phases as pp", "pp.id", "er.phase_id")
      .leftJoin("activities as a", "a.id", "er.activity_id")
      .leftJoin("project_documents as pd", "pd.id", "er.document_id")
      .leftJoin("suppliers as sup", "sup.id", "er.supplier_id");
  }

  return {
    listMaterialOrders(projectId: string, status?: MaterialOrderStatus): Promise<MaterialOrderRow[]> {
      const query = materialBase().where("mo.project_id", projectId);
      if (status) query.andWhere("mo.status", status);
      return query.select(...MATERIAL_SELECT).orderBy("mo.needed_by", "asc");
    },

    findMaterialOrder(id: string): Promise<MaterialOrderRow | undefined> {
      return materialBase().where("mo.id", id).select(...MATERIAL_SELECT).first();
    },

    async createMaterialOrder(record: NewMaterialOrderRecord): Promise<MaterialOrderRow> {
      await db("material_orders").insert(record);
      const row = await this.findMaterialOrder(record.id);
      if (!row) throw new Error("Failed to insert material order");
      return row;
    },

    async updateMaterialOrder(id: string, patch: MaterialOrderPatch): Promise<MaterialOrderRow | undefined> {
      await db("material_orders").where({ id }).update({ ...patch, updated_at: new Date() });
      return this.findMaterialOrder(id);
    },

    async deleteMaterialOrder(id: string): Promise<number> {
      return db("material_orders").where({ id }).delete();
    },

    /** One batched read for a page of orders — never one query per order. */
    listDeliveriesForOrders(orderIds: string[]): Promise<MaterialDeliveryRow[]> {
      if (orderIds.length === 0) return Promise.resolve([]);
      return db("material_deliveries as d")
        .leftJoin("user as u", "u.id", "d.received_by_id")
        .whereIn("d.order_id", orderIds)
        .select(...DELIVERY_SELECT)
        .orderBy("d.delivered_at", "asc");
    },

    async insertDelivery(record: NewMaterialDeliveryRecord): Promise<MaterialDeliveryRow> {
      await db("material_deliveries").insert(record);
      const row = await db("material_deliveries as d")
        .leftJoin("user as u", "u.id", "d.received_by_id")
        .where("d.id", record.id)
        .select(...DELIVERY_SELECT)
        .first();
      if (!row) throw new Error("Failed to insert material delivery");
      return row as MaterialDeliveryRow;
    },

    async linkDeliveryRecords(
      deliveryId: string,
      links: { ledger_entry_id?: string | null; transaction_id?: string | null },
    ): Promise<void> {
      await db("material_deliveries").where({ id: deliveryId }).update(links);
    },

    /**
     * Approval status of the material-approval request covering each order's
     * material, worst-first: a Rejected or Pending sample blocks the order.
     */
    async approvalStatusByMaterial(projectId: string): Promise<Map<string, string>> {
      const rows = await db("approvals as a")
        .join("material_approval_details as d", "d.approval_id", "a.id")
        .where({ "a.project_id": projectId, "a.kind": "material" })
        .orderBy("a.created_at", "desc")
        .select("d.material_name", "a.status");
      const byMaterial = new Map<string, string>();
      for (const row of rows as Array<{ material_name: string; status: string }>) {
        const key = row.material_name.trim().toLowerCase();
        const current = byMaterial.get(key);
        // The latest decision wins unless an earlier one is still unresolved.
        if (!current || (current === "Approved" && row.status !== "Approved")) {
          byMaterial.set(key, row.status);
        }
      }
      return byMaterial;
    },

    async createMaterialProcurementFromOrder(order: MaterialOrderRow): Promise<void> {
      await db("material_procurements")
        .insert({
          id: `mp_${order.id}`,
          project_id: order.project_id,
          material_order_id: order.id,
          name: order.material_name,
          purchased_at: order.delivered_at ?? order.expected_delivery_at ?? order.needed_by,
          receipt: order.document_name ?? `Material order ${order.id}`,
          amount: order.actual_cost,
          thumbnail_tone: "orange",
          sort_order: 0,
        })
        .onConflict("id")
        .merge({
          name: order.material_name,
          purchased_at: order.delivered_at ?? order.expected_delivery_at ?? order.needed_by,
          receipt: order.document_name ?? `Material order ${order.id}`,
          amount: order.actual_cost,
        });
    },

    listEquipmentRequests(projectId: string, bucket?: EquipmentBucket): Promise<EquipmentRequestRow[]> {
      const query = equipmentBase().where("er.project_id", projectId);
      if (bucket) query.whereIn("er.status", equipmentStatusesForBucket(bucket));
      return query.select(...EQUIPMENT_SELECT).orderBy("er.needed_from", "asc");
    },

    findEquipmentRequest(id: string): Promise<EquipmentRequestRow | undefined> {
      return equipmentBase().where("er.id", id).select(...EQUIPMENT_SELECT).first();
    },

    async createEquipmentRequest(record: NewEquipmentRequestRecord): Promise<EquipmentRequestRow> {
      await db("equipment_requests").insert(record);
      const row = await this.findEquipmentRequest(record.id);
      if (!row) throw new Error("Failed to insert equipment request");
      return row;
    },

    async updateEquipmentRequest(id: string, patch: EquipmentRequestPatch): Promise<EquipmentRequestRow | undefined> {
      await db("equipment_requests").where({ id }).update({ ...patch, updated_at: new Date() });
      return this.findEquipmentRequest(id);
    },

    async appendHireExtension(
      id: string,
      extensions: EquipmentHireExtension[],
      patch: EquipmentRequestPatch,
    ): Promise<EquipmentRequestRow | undefined> {
      await db("equipment_requests")
        .where({ id })
        .update({ ...patch, extensions: JSON.stringify(extensions), updated_at: new Date() });
      return this.findEquipmentRequest(id);
    },

    async deleteEquipmentRequest(id: string): Promise<number> {
      return db("equipment_requests").where({ id }).delete();
    },
  };
}

export function equipmentStatusesForBucket(bucket: EquipmentBucket): EquipmentRequestStatus[] {
  switch (bucket) {
    case "requests":
      return ["Draft", "Requested"];
    case "approvals":
      return ["Requested"];
    case "schedule":
      return ["Approved"];
    case "on-hire":
      return ["Scheduled", "OnHire"];
    case "returns":
      return ["Returned", "Cancelled", "Rejected"];
  }
}

export type MaterialsEquipmentRepository = ReturnType<typeof materialsEquipmentRepository>;
