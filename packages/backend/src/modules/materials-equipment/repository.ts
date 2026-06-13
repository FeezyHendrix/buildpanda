import type { Knex } from "knex";
import type { CurrencyCode } from "../../lib/currencies.ts";
import type {
  EquipmentBucket,
  EquipmentRequestRow,
  EquipmentRequestStatus,
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
  estimated_cost: string;
  actual_cost: string;
  currency: CurrencyCode;
  delivery_location: string | null;
  notes: string | null;
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
  estimated_cost: string;
  actual_cost: string;
  currency: CurrencyCode;
  delivery_location: string | null;
  operator_required: string;
  notes: string | null;
}

export type EquipmentRequestPatch = Partial<Omit<NewEquipmentRequestRecord, "id" | "project_id" | "requested_by_id">> & {
  updated_at?: Date;
};

const MATERIAL_SELECT = [
  "mo.id",
  "mo.project_id",
  "mo.title",
  "mo.material_name",
  "mo.quantity",
  "mo.unit",
  "mo.supplier",
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
  "mo.estimated_cost",
  "mo.actual_cost",
  "mo.currency",
  "mo.delivery_location",
  "mo.notes",
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
  "er.estimated_cost",
  "er.actual_cost",
  "er.currency",
  "er.delivery_location",
  "er.operator_required",
  "er.notes",
  "er.created_at",
  "er.updated_at",
] as const;

export function materialsEquipmentRepository(db: Knex) {
  function materialBase() {
    return db("material_orders as mo")
      .leftJoin("project_phases as pp", "pp.id", "mo.phase_id")
      .leftJoin("activities as a", "a.id", "mo.activity_id")
      .leftJoin("project_documents as pd", "pd.id", "mo.document_id")
      .leftJoin("material_procurements as mp", "mp.material_order_id", "mo.id");
  }

  function equipmentBase() {
    return db("equipment_requests as er")
      .leftJoin("project_phases as pp", "pp.id", "er.phase_id")
      .leftJoin("activities as a", "a.id", "er.activity_id")
      .leftJoin("project_documents as pd", "pd.id", "er.document_id");
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
      return ["Returned", "Cancelled"];
  }
}

export type MaterialsEquipmentRepository = ReturnType<typeof materialsEquipmentRepository>;
