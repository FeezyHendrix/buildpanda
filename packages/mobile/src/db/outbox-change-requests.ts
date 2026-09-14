import { eq } from "drizzle-orm";
import { changeCurrency, changeRequestsApi, changeStatus } from "@/api/change-requests";
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

  const status = changeStatus(row.status);
  const fields = {
    title: row.title,
    description: row.description,
    descriptionHtml: row.descriptionHtml,
    reason: row.reason,
    costImpact: row.costImpact,
    timeImpactDays: row.timeImpactDays,
    currency: changeCurrency(row.currency),
  };

  if (item.operation === "update") {
    await changeRequestsApi.update(item.projectId, row.id, { ...fields, status });
    await changeRequestsRepository.markSynced(db, row.id);
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(true);
  }

  const server = await changeRequestsApi.create(item.projectId, fields);
  await changeRequestsRepository.reconcileCreate(db, item.projectId, row.id, server);
  await db.delete(outbox).where(eq(outbox.id, item.id));

  // The create route does not take a status: every request starts as a Draft
  // on the server. A request submitted on site before it had signal is moved
  // on by a queued update against the new id — queued, not sent inline, so a
  // drop between the two calls retries the PATCH rather than the POST.
  if (status !== server.status) {
    await changeRequestsRepository.updateLocal(db, item.projectId, server.id, { status });
  }
  return done(true);
}
