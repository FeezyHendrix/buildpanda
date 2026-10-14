import { approvalTierStatus } from "@/lib/api-access";
import { requireMaterialApproval } from "./record-permissions";
import { canRecordDelivery } from "@/api/materials";
import { repositoryAccess } from "./permissions";
import { features } from "@/lib/feature-access";
import { remapQueuedRecord } from "./sync-write-state";
import { randomUUID } from "expo-crypto";
import { desc, eq } from "drizzle-orm";
import type { CreateMaterialOrderInput, MaterialOrder } from "@/api/materials";
import type { Db } from "./client";
import { enqueueDelete, enqueueUpdate, reviveOrQueue } from "./enqueue-update";
import { materialOrders, outbox, type MaterialOrderRow } from "./schema";

/** What the server owns on an order: everything a pull or a push reply refreshes. */
function serverValues(row: MaterialOrder) {
  return {
    title: row.title,
    materialName: row.materialName,
    quantity: row.quantity,
    unit: row.unit,
    supplier: row.supplier,
    phaseId: row.phaseId,
    phaseName: row.phaseName,
    neededBy: row.neededBy,
    status: row.status,
    approvalId: row.approvalId ?? null,
    approvalTitle: row.approvalTitle ?? null,
    approvalStatus: row.approvalStatus ?? null,
    deliveredQuantity: row.deliveredQuantity ?? 0,
  };
}

const access = repositoryAccess(features.materialOrders);

export function toMaterialOrder(row: MaterialOrderRow) {
  const delivered = row.deliveredQuantity + row.pendingDeliveryQty;
  return {
    id: row.id,
    title: row.title,
    materialName: row.materialName,
    quantity: row.quantity,
    unit: row.unit,
    supplier: row.supplier,
    phaseId: row.phaseId,
    phaseName: row.phaseName,
    neededBy: row.neededBy,
    status: row.status,
    approvalId: row.approvalId,
    approvalTitle: row.approvalTitle,
    approvalStatus: row.approvalStatus,
    /** Server-accepted plus anything received here and not yet sent. */
    deliveredQuantity: delivered,
    outstandingQuantity: Math.max(0, Math.round((row.quantity - delivered) * 100) / 100),
    pendingDeliveryQty: row.pendingDeliveryQty,
    isPendingSync: row.isPendingSync,
  };
}

export const materialsRepository = {
  listQuery: (db: Db, projectId: string) =>
    db
      .select()
      .from(materialOrders)
      .where(access.where(db, materialOrders.projectId, eq(materialOrders.projectId, projectId)))
      .orderBy(desc(materialOrders.updatedAt)),

  /** One row for a detail or edit screen; re-runs only when that row changes. */
  byIdQuery: (db: Db, id: string) =>
    db.select().from(materialOrders).where(access.where(db, materialOrders.projectId, eq(materialOrders.id, id))).limit(1),

  async createLocal(db: Db, projectId: string, input: CreateMaterialOrderInput): Promise<string> {
    access.require(db, projectId, "edit");
    if (approvalTierStatus(input.status)) requireMaterialApproval(db, projectId);
    const id = `local_${randomUUID()}`;
    await access.transaction(db, projectId, "create", (tx) => {
      tx.insert(materialOrders).values({
        id,
        projectId,
        title: input.title,
        materialName: input.materialName,
        quantity: input.quantity,
        unit: input.unit,
        supplier: input.supplier ?? null,
        phaseId: input.phaseId ?? null,
        neededBy: input.neededBy,
        approvalId: input.approvalId ?? null,
        isPendingSync: true,
        updatedAt: Date.now(),
      }).run();
      tx.insert(outbox).values({
        id: randomUUID(),
        resource: "material-orders",
        entityId: id,
        projectId,
        operation: "create",
        nextAttemptAt: 0,
      }).run();
    });
    return id;
  },

  async markSynced(db: Db, id: string): Promise<void> {
    await db.update(materialOrders).set({ isPendingSync: false }).where(access.where(db, materialOrders.projectId, eq(materialOrders.id, id)));
  },

  /** Removes the row locally and queues the push in one transaction. */
  async deleteLocal(db: Db, projectId: string, id: string): Promise<void> {
    access.require(db, projectId, "edit");
    access.record(db, materialOrders, id, projectId);
    requireMaterialApproval(db, projectId);
    await access.transaction(db, projectId, "edit", (tx) => {
      tx.delete(materialOrders).where(access.where(db, materialOrders.projectId, eq(materialOrders.id, id))).run();
      enqueueDelete(tx, "material-orders", id, projectId, randomUUID());
    });
  },

  /**
   * Applies an edit locally and queues the push in one transaction.
   *
   * A status change is queued as its own `set-status` push rather than folded
   * into the field update: the server gates delivery statuses behind the
   * `approve` permission, so a PATCH that echoed the row's status on every
   * title edit would 403 a crew member who is only allowed to request. The
   * outbox carries no payload, so the operation name is what tells the push
   * which body to send.
   */
  async updateLocal(
    db: Db,
    projectId: string,
    id: string,
    patch: Partial<CreateMaterialOrderInput>,
  ): Promise<void> {
    access.require(db, projectId, "edit");
    access.record(db, materialOrders, id, projectId);
    if (approvalTierStatus(patch.status)) requireMaterialApproval(db, projectId);
    const { status, ...fields } = patch;
    const hasFieldEdit = Object.values(fields).some((value) => value !== undefined);

    await access.transaction(db, projectId, "edit", (tx) => {
      tx
        .update(materialOrders)
        .set({
          ...(fields.title !== undefined ? { title: fields.title } : {}),
          ...(fields.materialName !== undefined ? { materialName: fields.materialName } : {}),
          ...(fields.quantity !== undefined ? { quantity: fields.quantity } : {}),
          ...(fields.unit !== undefined ? { unit: fields.unit } : {}),
          ...(fields.supplier !== undefined ? { supplier: fields.supplier } : {}),
          ...(fields.phaseId !== undefined ? { phaseId: fields.phaseId } : {}),
          ...(fields.neededBy !== undefined ? { neededBy: fields.neededBy } : {}),
          ...(status !== undefined ? { status } : {}),
          isPendingSync: true,
          updatedAt: Date.now(),
        })
        .where(access.where(db, materialOrders.projectId, eq(materialOrders.id, id))).run();

      if (hasFieldEdit) {
        enqueueUpdate(tx, "material-orders", id, projectId, randomUUID());
      }
      if (status !== undefined) {
        reviveOrQueue(tx, {
          resource: "material-orders",
          entityId: id,
          projectId,
          operation: "set-status",
          newId: randomUUID(),
        });
      }
    });
  },

  async reconcileCreate(db: Db, projectId: string, localId: string, server: MaterialOrder) {
    access.require(db, projectId);
    await access.transaction(db, projectId, "read", (tx) => {
      const [local] = tx.select().from(materialOrders).where(access.where(db, materialOrders.projectId, eq(materialOrders.id, localId))).limit(1).all();
      const hasEdits = remapQueuedRecord(tx, "material-orders", localId, server.id);
      if (!local) return;
      tx.delete(materialOrders).where(access.where(db, materialOrders.projectId, eq(materialOrders.id, localId))).run();
      const values = {
        projectId,
        ...serverValues(server),
        ...(hasEdits ? local : {}),
        id: server.id,
        isPendingSync: hasEdits,
        updatedAt: Date.now(),
      };
      // A concurrent pull may already have received the server-assigned ID.
      // Preserve any later local edit on that row while reconciling the draft.
      tx.insert(materialOrders).values(values).onConflictDoUpdate({
        target: materialOrders.id,
        set: values,
        where: eq(materialOrders.isPendingSync, false),
      }).run();
    });
  },

  async upsertFromServer(db: Db, projectId: string, rows: readonly MaterialOrder[]) {
    access.require(db, projectId);
    if (rows.length === 0) return;
    const now = Date.now();
    await access.transaction(db, projectId, "read", (tx) => {
      for (const row of rows) {
        tx
          .insert(materialOrders)
          .values({ id: row.id, projectId, ...serverValues(row), isPendingSync: false, updatedAt: now })
          .onConflictDoUpdate({
            target: materialOrders.id,
            set: { ...serverValues(row), updatedAt: now },
            where: eq(materialOrders.isPendingSync, false),
          }).run();
      }
    });
  },

  /**
   * Goods received on site, recorded offline. Repeated deliveries before the
   * next sync add up and go as one; the order shows them at once.
   */
  async recordDeliveryLocal(db: Db, projectId: string, id: string, quantity: number, note: string | null): Promise<void> {
    await access.transaction(db, projectId, "receive", (tx) => {
      const [row] = tx.select().from(materialOrders).where(access.where(db, materialOrders.projectId, eq(materialOrders.id, id))).limit(1).all();
      if (!row) throw new Error("This order is no longer on this device.");
      if (!canRecordDelivery(row.status) || id.startsWith("local_") || !Number.isFinite(quantity) || quantity <= 0) throw new Error("This order cannot receive this delivery.");
      const pending = row.pendingDeliveryQty + quantity;
      const delivered = row.deliveredQuantity + pending;
      tx.update(materialOrders).set({
        pendingDeliveryQty: pending,
        pendingDeliveryNote: [row.pendingDeliveryNote, note].filter(Boolean).join(", ") || null,
        status: delivered >= row.quantity ? "Delivered" : "PartiallyDelivered",
        isPendingSync: true,
        updatedAt: Date.now(),
      }).where(access.where(db, materialOrders.projectId, eq(materialOrders.id, id))).run();
      reviveOrQueue(tx, { resource: "material-orders", entityId: id, projectId, operation: "delivery", newId: randomUUID() });
    });
  },

  /** The server took the delivery: its order replaces ours and nothing is pending. */
  async settleDelivery(db: Db, id: string, server: MaterialOrder): Promise<void> {
    await db.update(materialOrders).set({
      ...serverValues(server),
      pendingDeliveryQty: 0,
      pendingDeliveryNote: null,
      updatedAt: Date.now(),
    }).where(access.where(db, materialOrders.projectId, eq(materialOrders.id, id)));
  },

  findById: async (db: Db, id: string) => {
    const [row] = await db.select().from(materialOrders).where(access.where(db, materialOrders.projectId, eq(materialOrders.id, id))).limit(1);
    return row;
  },
};
