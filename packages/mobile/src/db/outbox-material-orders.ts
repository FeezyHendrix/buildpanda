import { and, eq, ne } from "drizzle-orm";
import { MATERIAL_ORDER_STATUSES, materialsApi, type MaterialOrderStatus } from "@/api/materials";
import type { Db } from "./client";
import { materialsRepository } from "./materials-repository";
import { done, PermanentOutboxError, skipped, type OutboxHandlerResult } from "./outbox-handler";
import { outbox, type OutboxRow } from "./schema";

function isMaterialOrderStatus(value: string): value is MaterialOrderStatus {
  return (MATERIAL_ORDER_STATUSES as readonly string[]).includes(value);
}

/**
 * A field edit and a delivery can be queued side by side. The row stays
 * pending until the last of them lands, or a pull between the two would
 * overwrite the status the second push is about to send.
 */
async function settle(db: Db, item: OutboxRow): Promise<void> {
  await db.delete(outbox).where(eq(outbox.id, item.id));
  const [sibling] = await db
    .select({ id: outbox.id })
    .from(outbox)
    .where(and(eq(outbox.resource, item.resource), eq(outbox.entityId, item.entityId), ne(outbox.id, item.id)))
    .limit(1);
  if (!sibling) await materialsRepository.markSynced(db, item.entityId);
}

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

  // A delivery recorded from the field sends only the status: the server
  // gates it behind `approve`, and mixing it into a field edit would drag
  // that gate onto plain title changes. Sent before the needed-by check
  // because the status endpoint does not require the date.
  if (item.operation === "set-status") {
    if (!isMaterialOrderStatus(row.status)) {
      throw new PermanentOutboxError(`"${row.status}" is not a status the server accepts.`);
    }
    await materialsApi.update(item.projectId, row.id, { status: row.status });
    await settle(db, item);
    return done(true);
  }

  // Orders queued before the column existed have no date; the API refuses
  // them, so say so plainly rather than looping on a 400.
  if (!row.neededBy) {
    throw new PermanentOutboxError("This order has no needed-by date. Edit it and add one, then retry.");
  }

  if (item.operation === "update") {
    await materialsApi.update(item.projectId, row.id, {
      title: row.title,
      materialName: row.materialName,
      quantity: row.quantity,
      unit: row.unit,
      neededBy: row.neededBy,
      supplier: row.supplier,
      phaseId: row.phaseId,
    });
    await settle(db, item);
    return done(true);
  }

  const server = await materialsApi.create(item.projectId, {
    title: row.title,
    materialName: row.materialName,
    quantity: row.quantity,
    unit: row.unit,
    neededBy: row.neededBy,
    supplier: row.supplier,
    phaseId: row.phaseId,
  });
  await materialsRepository.reconcileCreate(db, item.projectId, row.id, server);
  await db.delete(outbox).where(eq(outbox.id, item.id));
  return done(true);
}
