import { randomUUID } from "expo-crypto";
import { desc, eq } from "drizzle-orm";
import type { CreateMaterialOrderInput, MaterialOrder } from "@/api/materials";
import type { Db } from "./client";
import { materialOrders, outbox, type MaterialOrderRow } from "./schema";

export function toMaterialOrder(row: MaterialOrderRow) {
  return {
    id: row.id,
    title: row.title,
    materialName: row.materialName,
    quantity: row.quantity,
    unit: row.unit,
    supplier: row.supplier,
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
