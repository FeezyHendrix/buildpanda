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
    await db.transaction(async (tx) => {
      await tx.insert(materialOrders).values({
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
      });
      await tx.insert(outbox).values({
        id: randomUUID(),
        resource: "material-orders",
        entityId: id,
        projectId,
        operation: "create",
        nextAttemptAt: 0,
      });
    });
    return id;
  },

  async markSynced(db: Db, id: string): Promise<void> {
    await db.update(materialOrders).set({ isPendingSync: false }).where(eq(materialOrders.id, id));
  },

  /** Removes the row locally and queues the push in one transaction. */
  async deleteLocal(db: Db, projectId: string, id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(materialOrders).where(eq(materialOrders.id, id));
      await enqueueDelete(tx as never, "material-orders", id, projectId, randomUUID());
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

    await db.transaction(async (tx) => {
      await tx
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
        .where(eq(materialOrders.id, id));

      if (hasFieldEdit) {
        await enqueueUpdate(tx as never, "material-orders", id, projectId, randomUUID());
      }
      if (status !== undefined) {
        await reviveOrQueue(tx as never, {
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
    await db.transaction(async (tx) => {
      await tx.delete(materialOrders).where(eq(materialOrders.id, localId));
      await tx.insert(materialOrders).values({
        id: server.id,
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
        isPendingSync: false,
        updatedAt: Date.now(),
      });
    });
  },

  async upsertFromServer(db: Db, projectId: string, rows: readonly MaterialOrder[]) {
    if (rows.length === 0) return;
    const now = Date.now();
    await db.transaction(async (tx) => {
      for (const row of rows) {
        await tx
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
          });
      }
    });
  },

  findById: async (db: Db, id: string) => {
    const [row] = await db.select().from(materialOrders).where(eq(materialOrders.id, id)).limit(1);
    return row;
  },
};
