import { and, eq, sql } from "drizzle-orm";
import type { Db } from "./client";
import { OUTBOX_TABLES } from "./outbox-tables";
import { outbox, type OutboxRow } from "./schema";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// Queue IDs are UUIDs. Once a request starts, further edits need their own
// queue entry: the request body already contains the earlier values.
const sending = new Set<string>();
export const isOutboxItemSending = (id: string) => sending.has(id);
export function startSending(id: string) { sending.add(id); }
export function finishSending(id: string) { sending.delete(id); }

export function isRecordSending(tx: Tx, resource: string, entityId: string): boolean {
  return tx.select({ id: outbox.id }).from(outbox)
    .where(and(eq(outbox.resource, resource), eq(outbox.entityId, entityId)))
    .all().some((row) => sending.has(row.id));
}

/** Repoint follow-up edits/deletes when the server assigns a permanent ID. */
export function remapQueuedRecord(tx: Tx, resource: string, localId: string, serverId: string): boolean {
  const queued = tx.select().from(outbox)
    .where(and(eq(outbox.resource, resource), eq(outbox.entityId, localId))).all();
  tx.update(outbox).set({ entityId: serverId })
    .where(and(eq(outbox.resource, resource), eq(outbox.entityId, localId))).run();
  return queued.some((row) => row.operation !== "create");
}

/** A successful request clears only its own work, never a newer edit. */
export function settleOutboxItem(db: Db, item: OutboxRow): void {
  db.transaction((tx) => {
    tx.delete(outbox).where(eq(outbox.id, item.id)).run();
    const [remaining] = tx.select({ id: outbox.id }).from(outbox)
      .where(and(eq(outbox.resource, item.resource), eq(outbox.entityId, item.entityId))).limit(1).all();
    const table = OUTBOX_TABLES[item.resource];
    if (!remaining && table) {
      tx.run(sql`UPDATE ${table} SET is_pending_sync = 0 WHERE id = ${item.entityId}`);
    }
  });
}
