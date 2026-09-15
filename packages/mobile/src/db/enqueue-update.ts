import { and, eq } from "drizzle-orm";
import { outbox } from "./schema";
import { isOutboxItemSending } from "./sync-write-state";

import type { Db } from "./client";

// Expo SQLite transactions are synchronous; helpers must finish before commit.
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

function findQueued(tx: Tx, resource: string, entityId: string, operation: string, includeSending = false) {
  const rows = tx
    .select({ id: outbox.id, status: outbox.status })
    .from(outbox)
    .where(
      and(eq(outbox.resource, resource), eq(outbox.entityId, entityId), eq(outbox.operation, operation)),
    )
    .all();
  return rows.find((row) => includeSending || !isOutboxItemSending(row.id)) ?? null;
}

function revive(tx: Tx, id: string): void {
  tx
    .update(outbox)
    .set({ status: "pending", attempts: 0, nextAttemptAt: 0, lastError: null })
    .where(eq(outbox.id, id)).run();
}

/**
 * Queues one push per record and operation, in the caller's transaction.
 *
 * A row that already failed is revived rather than left dead beside a fresh
 * one: the local record carries the crew member's newest edit, so sending it
 * again is exactly what they asked for. Pending rows are reused until sending
 * starts; later edits get a follow-up entry with the new values.
 */
export function reviveOrQueue(
  tx: Tx,
  row: { resource: string; entityId: string; projectId: string; operation: string; newId: string },
): void {
  const existing = findQueued(tx, row.resource, row.entityId, row.operation);
  if (existing) {
    if (existing.status === "failed") revive(tx, existing.id);
    return;
  }
  tx.insert(outbox).values({
    id: row.newId,
    resource: row.resource,
    entityId: row.entityId,
    projectId: row.projectId,
    operation: row.operation,
    nextAttemptAt: 0,
  }).run();
}

/**
 * Queues an edit for push, in the caller's transaction.
 *
 * Returns without queuing when the record's create has not started: its id has
 * never reached the server, so an update would PATCH something that does not
 * exist — the queued create carries the newer local state instead. A second
 * edit coalesces onto the update already queued rather than stacking rows.
 *
 * Shared so this rule has one home; duplicating it per repository is how one
 * copy quietly loses the guard. The row id is passed in rather than generated
 * here, so this stays free of native modules and can be tested directly.
 */
export function enqueueUpdate(
  tx: Tx,
  resource: string,
  entityId: string,
  projectId: string,
  newId: string,
): void {
  const create = findQueued(tx, resource, entityId, "create");
  if (create) {
    if (create.status === "failed") revive(tx, create.id);
    return;
  }
  reviveOrQueue(tx, { resource, entityId, projectId, operation: "update", newId });
}

/**
 * Queues a delete for push, in the caller's transaction.
 *
 * Any work already queued for the record is dropped first: an update to a row
 * that is about to disappear is pointless. If its create never left the device
 * then the server has no such record, so nothing is queued at all — pushing a
 * delete for an id the server has never seen would 404.
 */
export function enqueueDelete(
  tx: Tx,
  resource: string,
  entityId: string,
  projectId: string,
  newId: string,
): void {
  const create = findQueued(tx, resource, entityId, "create", true);
  const neverReachedServer = create !== null && !isOutboxItemSending(create.id);
  const queued = tx.select({ id: outbox.id }).from(outbox)
    .where(and(eq(outbox.resource, resource), eq(outbox.entityId, entityId))).all();
  for (const row of queued) {
    if (!isOutboxItemSending(row.id)) tx.delete(outbox).where(eq(outbox.id, row.id)).run();
  }

  if (neverReachedServer) return;

  tx.insert(outbox).values({
    id: newId,
    resource,
    entityId,
    projectId,
    operation: "delete",
    nextAttemptAt: 0,
  }).run();
}
