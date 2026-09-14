import { eq } from "drizzle-orm";
import { lookAheadsApi } from "@/api/look-aheads";
import type { Db } from "./client";
import { lookAheadsRepository, parseActivityIds } from "./look-aheads-repository";
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
    // KNOWN LIMITATION: the PATCH takes assign/unassign deltas, but the device
    // only holds the list as it stands now, not the list the server last had
    // — the outbox carries no payload and fetching the server copy before a
    // push is not allowed offline-first. So an edit pushes the whole local
    // list as assignments and never unassigns; the server treats an already
    // assigned activity as a no-op. Removing an activity from the window
    // therefore sticks locally only until the next pull restores it. Taking
    // an activity out of a look-ahead is done on the web.
    await lookAheadsApi.update(item.projectId, row.id, {
      name: row.name,
      description: row.description,
      startDate: row.startDate,
      endDate: row.endDate,
      totalWorkers: row.totalWorkers,
      assignActivityIds: parseActivityIds(row.activityIds),
      unassignActivityIds: [],
    });
    await lookAheadsRepository.markSynced(db, row.id);
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(true);
  }

  // The building is fixed at creation: the API needs it on a multi-building
  // project and its PATCH schema does not accept it.
  const server = await lookAheadsApi.create(item.projectId, {
    name: row.name,
    description: row.description,
    startDate: row.startDate,
    endDate: row.endDate,
    totalWorkers: row.totalWorkers,
    buildingId: row.buildingId,
    activityIds: parseActivityIds(row.activityIds),
  });
  await lookAheadsRepository.reconcileCreate(db, item.projectId, row.id, server);
  await db.delete(outbox).where(eq(outbox.id, item.id));
  return done(true);
}
