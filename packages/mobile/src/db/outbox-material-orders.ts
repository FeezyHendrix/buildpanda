import { eq } from "drizzle-orm";
import { materialsApi } from "@/api/materials";
import type { Db } from "./client";
import { materialsRepository } from "./materials-repository";
import { done, skipped, type OutboxHandlerResult } from "./outbox-handler";
import { outbox, type OutboxRow } from "./schema";

export async function pushMaterialOrderOutboxItem(
  db: Db,
  item: OutboxRow,
): Promise<OutboxHandlerResult> {
  if (item.resource !== "material-orders") return skipped;

  if (item.operation === "delete") {
    await materialsApi.remove(item.projectId, item.entityId);
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(true);
  }

  const row = await materialsRepository.findById(db, item.entityId);
  if (!row) {
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(false);
  }

  if (item.operation === "update") {
    await materialsApi.update(item.projectId, row.id, {
      title: row.title,
      materialName: row.materialName,
      quantity: row.quantity,
      unit: row.unit,
      supplier: row.supplier,
      phaseId: row.phaseId,
    });
    await materialsRepository.markSynced(db, row.id);
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(true);
  }

  const server = await materialsApi.create(item.projectId, {
    title: row.title,
    materialName: row.materialName,
    quantity: row.quantity,
    unit: row.unit,
    supplier: row.supplier,
    phaseId: row.phaseId,
  });
  await materialsRepository.reconcileCreate(db, item.projectId, row.id, server);
  await db.delete(outbox).where(eq(outbox.id, item.id));
  return done(true);
}
