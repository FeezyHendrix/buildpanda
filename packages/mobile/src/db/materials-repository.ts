import { remapQueuedRecord } from "./sync-write-state";
import { randomUUID } from "expo-crypto";
import { desc, eq } from "drizzle-orm";
import type { CreateMaterialOrderInput, MaterialOrder } from "@/api/materials";
import type { Db } from "./client";
import { enqueueDelete, enqueueUpdate, reviveOrQueue } from "./enqueue-update";
import { materialOrders, outbox, type MaterialOrderRow } from "./schema";

export function toMaterialOrder(row: MaterialOrderRow) {
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
    isPendingSync: row.isPendingSync,
  };
}

export const materialsRepository = {
  listQuery: (db: Db, projectId: string) =>
    db
      .select()
      .from(materialOrders)
      .where(eq(materialOrders.projectId, projectId))
      .orderBy(desc(materialOrders.updatedAt)),

  /** One row for a detail or edit screen; re-runs only when that row changes. */
  byIdQuery: (db: Db, id: string) =>
    db.select().from(materialOrders).where(eq(materialOrders.id, id)).limit(1),

  async createLocal(db: Db, projectId: string, input: CreateMaterialOrderInput): Promise<string> {
    const id = `local_${randomUUID()}`;
    await db.transaction((tx) => {
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
    await db.update(materialOrders).set({ isPendingSync: false }).where(eq(materialOrders.id, id));
  },

  /** Removes the row locally and queues the push in one transaction. */
  async deleteLocal(db: Db, projectId: string, id: string): Promise<void> {
    await db.transaction((tx) => {
      tx.delete(materialOrders).where(eq(materialOrders.id, id)).run();
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
    const { status, ...fields } = patch;
    const hasFieldEdit = Object.values(fields).some((value) => value !== undefined);

    await db.transaction((tx) => {
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
        .where(eq(materialOrders.id, id)).run();

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
    await db.transaction((tx) => {
      const [local] = tx.select().from(materialOrders).where(eq(materialOrders.id, localId)).limit(1).all();
      const hasEdits = remapQueuedRecord(tx, "material-orders", localId, server.id);
      if (!local) return;
      tx.delete(materialOrders).where(eq(materialOrders.id, localId)).run();
      const values = {
        projectId,
        title: server.title,
        materialName: server.materialName,
        quantity: server.quantity,
        unit: server.unit,
        supplier: server.supplier,
        phaseId: server.phaseId,
        phaseName: server.phaseName,
        neededBy: server.neededBy,
        status: server.status,
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
    if (rows.length === 0) return;
    const now = Date.now();
    await db.transaction((tx) => {
      for (const row of rows) {
        tx
          .insert(materialOrders)
          .values({
            id: row.id,
            projectId,
            title: row.title,
            materialName: row.materialName,
            quantity: row.quantity,
            unit: row.unit,
            supplier: row.supplier,
            phaseId: row.phaseId,
            phaseName: row.phaseName,
            neededBy: row.neededBy,
            status: row.status,
            isPendingSync: false,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: materialOrders.id,
            set: {
              title: row.title,
              materialName: row.materialName,
              quantity: row.quantity,
              unit: row.unit,
              supplier: row.supplier,
              phaseId: row.phaseId,
              phaseName: row.phaseName,
              neededBy: row.neededBy,
              status: row.status,
              updatedAt: now,
            },
            where: eq(materialOrders.isPendingSync, false),
          }).run();
      }
    });
  },

  findById: async (db: Db, id: string) => {
    const [row] = await db.select().from(materialOrders).where(eq(materialOrders.id, id)).limit(1);
    return row;
  },
};
