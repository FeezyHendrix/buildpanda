import { eq } from "drizzle-orm";
import { lookAheadsApi } from "@/api/look-aheads";
import type { Db } from "./client";
import { lookAheadsRepository } from "./look-aheads-repository";
import { done, skipped, type OutboxHandlerResult } from "./outbox-handler";
import { outbox, type OutboxRow } from "./schema";

export async function pushLookAheadOutboxItem(
  db: Db,
  item: OutboxRow,
): Promise<OutboxHandlerResult> {
  if (item.resource !== "look-aheads") return skipped;

  if (item.operation === "delete") {
    await lookAheadsApi.remove(item.projectId, item.entityId);
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(true);
  }

  const row = await lookAheadsRepository.findById(db, item.entityId);
  if (!row) {
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(false);
  }

  if (item.operation === "update") {
    await lookAheadsApi.update(item.projectId, row.id, {
      name: row.name,
      description: row.description,
      startDate: row.startDate,
      endDate: row.endDate,
      totalWorkers: row.totalWorkers,
      ...(row.buildingId ? { buildingId: row.buildingId } : {}),
    });
    await lookAheadsRepository.markSynced(db, row.id);
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(true);
  }

  const server = await lookAheadsApi.create(item.projectId, {
    name: row.name,
    description: row.description,
    startDate: row.startDate,
    endDate: row.endDate,
    totalWorkers: row.totalWorkers,
  });
  await lookAheadsRepository.reconcileCreate(db, item.projectId, row.id, server);
  await db.delete(outbox).where(eq(outbox.id, item.id));
  return done(true);
}
