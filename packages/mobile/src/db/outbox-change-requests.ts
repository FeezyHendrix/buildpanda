import { eq } from "drizzle-orm";
import { changeRequestsApi } from "@/api/change-requests";
import type { Db } from "./client";
import { changeRequestsRepository } from "./change-requests-repository";
import { done, skipped, type OutboxHandlerResult } from "./outbox-handler";
import { outbox, type OutboxRow } from "./schema";

export async function pushChangeRequestOutboxItem(
  db: Db,
  item: OutboxRow,
): Promise<OutboxHandlerResult> {
  if (item.resource !== "change-requests") return skipped;

  if (item.operation === "delete") {
    await changeRequestsApi.remove(item.projectId, item.entityId);
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(true);
  }

  const row = await changeRequestsRepository.findById(db, item.entityId);
  if (!row) {
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(false);
  }

  if (item.operation === "update") {
    await changeRequestsApi.update(item.projectId, row.id, {
      title: row.title,
      description: row.description,
      descriptionHtml: row.descriptionHtml,
      reason: row.reason,
      costImpact: row.costImpact,
      timeImpactDays: row.timeImpactDays,
    });
    await changeRequestsRepository.markSynced(db, row.id);
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(true);
  }

  const server = await changeRequestsApi.create(item.projectId, {
    title: row.title,
    description: row.description,
    descriptionHtml: row.descriptionHtml,
    reason: row.reason,
    costImpact: row.costImpact,
    timeImpactDays: row.timeImpactDays,
  });
  await changeRequestsRepository.reconcileCreate(db, item.projectId, row.id, server);
  await db.delete(outbox).where(eq(outbox.id, item.id));
  return done(true);
}
