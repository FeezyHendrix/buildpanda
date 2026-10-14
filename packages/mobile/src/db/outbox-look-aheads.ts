import { settleOutboxItem } from "./sync-write-state";
import { lookAheadsApi } from "@/api/look-aheads";
import type { Db } from "./client";
import { lookAheadsRepository, parseActivityIds } from "./look-aheads-repository";
import { done, skipped, PermanentOutboxError, type OutboxHandlerResult, dropItem, finishItem } from "./outbox-handler";
import { type OutboxRow } from "./schema";

export async function pushLookAheadOutboxItem(
  db: Db,
  item: OutboxRow,
): Promise<OutboxHandlerResult> {
  if (item.resource !== "look-aheads") return skipped;

  if (item.operation === "delete") {
    await lookAheadsApi.remove(item.projectId, item.entityId);
    return finishItem(db, item);
  }

  const row = await lookAheadsRepository.findById(db, item.entityId);
  if (!row) return dropItem(db, item);

  if (item.operation === "update" || item.operation === "set-activities") {
    if (item.operation === "set-activities") {
      // The device can edit offline. Resolve the API's assignment deltas only
      // when syncing, so removing an activity also reaches the server.
      const current = (await lookAheadsApi.list(item.projectId)).find((entry) => entry.id === row.id);
      if (!current) throw new PermanentOutboxError("This look ahead no longer exists on the server.");
      const wanted = new Set(parseActivityIds(row.activityIds));
      const assigned = new Set(current.activities.map((activity) => activity.activityId));
      await lookAheadsApi.update(item.projectId, row.id, {
        assignActivityIds: [...wanted].filter((id) => !assigned.has(id)),
        unassignActivityIds: [...assigned].filter((id) => !wanted.has(id)),
      });
    } else {
      await lookAheadsApi.update(item.projectId, row.id, {
        name: row.name,
        description: row.description,
        startDate: row.startDate,
        endDate: row.endDate,
        totalWorkers: row.totalWorkers,
      });
    }
    settleOutboxItem(db, item);
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
  return finishItem(db, item);
}
