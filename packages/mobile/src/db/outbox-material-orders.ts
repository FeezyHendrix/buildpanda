import { settleOutboxItem } from "./sync-write-state";
import { MATERIAL_ORDER_STATUSES, materialsApi, type MaterialOrderStatus } from "@/api/materials";
import type { Db } from "./client";
import { materialsRepository } from "./materials-repository";
import { done, PermanentOutboxError, skipped, type OutboxHandlerResult, dropItem, finishItem } from "./outbox-handler";
import { type OutboxRow } from "./schema";

function isMaterialOrderStatus(value: string): value is MaterialOrderStatus {
  return (MATERIAL_ORDER_STATUSES as readonly string[]).includes(value);
}

export async function pushMaterialOrderOutboxItem(
  db: Db,
  item: OutboxRow,
): Promise<OutboxHandlerResult> {
  if (item.resource !== "material-orders") return skipped;

  if (item.operation === "delete") {
    await materialsApi.remove(item.projectId, item.entityId);
    return finishItem(db, item);
  }

  const row = await materialsRepository.findById(db, item.entityId);
  if (!row) return dropItem(db, item);

  if (item.operation === "delivery") {
    // Goods against an order this device created wait for the create.
    if (row.id.startsWith("local_")) return done(false);
    if (row.pendingDeliveryQty <= 0) {
      settleOutboxItem(db, item);
      return done(false);
    }
    // A delivery has no idempotency key, so a push retried after a dropped
    // reply checks the server's total first rather than booking it twice.
    const accepted = (await materialsApi.deliveries(item.projectId, row.id))
      .filter((d) => !d.rejected)
      .reduce((sum, d) => sum + Number(d.deliveredQty), 0);
    let server;
    if (accepted >= row.deliveredQuantity + row.pendingDeliveryQty - 0.001) {
      server = (await materialsApi.list(item.projectId)).find((o) => o.id === row.id);
    } else {
      server = await materialsApi.recordDelivery(item.projectId, row.id, {
        deliveredQty: row.pendingDeliveryQty,
        deliveredAt: new Date().toISOString().slice(0, 10),
        deliveryNote: row.pendingDeliveryNote,
        notes: "Recorded on site",
      });
    }
    if (server) await materialsRepository.settleDelivery(db, row.id, server);
    settleOutboxItem(db, item);
    return done(true);
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
    settleOutboxItem(db, item);
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
    settleOutboxItem(db, item);
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
    // Only a synced approval has an id the server knows; otherwise it matches one.
    ...(row.approvalId && !row.approvalId.startsWith("local_") ? { approvalId: row.approvalId } : {}),
  });
  await materialsRepository.reconcileCreate(db, item.projectId, row.id, server);
  return finishItem(db, item);
}
