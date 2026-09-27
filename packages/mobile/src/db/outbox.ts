import { and, asc, eq, lte, sql } from "drizzle-orm";
import { getDbOwner, type Db } from "./client";
import NetInfo from "@react-native-community/netinfo";
import { readCachedUser } from "@/lib/session-cache";
import { pushChangeRequestCommentOutboxItem } from "./outbox-change-request-comments";
import { pushChangeRequestOutboxItem } from "./outbox-change-requests";
import { pushDailyLogOutboxItem } from "./outbox-daily-logs";
import { pushDocumentOutboxItem } from "./outbox-documents";
import { pushDrawingMarkupCommentOutboxItem, pushDrawingMarkupOutboxItem } from "./outbox-drawing-markups";
import { pushLookAheadOutboxItem } from "./outbox-look-aheads";
import { pushMaterialApprovalOutboxItem } from "./outbox-material-approvals";
import { pushMaterialOrderOutboxItem } from "./outbox-material-orders";
import { PermanentOutboxError } from "./outbox-handler";
import { pushRfiOutboxItem } from "./outbox-rfis";
import { OUTBOX_TABLES } from "./outbox-tables";
import { documents, drawingMarkupComments, outbox, type OutboxRow } from "./schema";
import { discardStagedMedia } from "../lib/stage-media";

import { startSending, finishSending } from "./sync-write-state";

const MAX_ATTEMPTS = 8;

const inFlight = new WeakMap<Db, Promise<FlushResult>>();

function nextDelayMs(attempts: number): number {
  const base = Math.min(15_000 * 2 ** attempts, 30 * 60_000);
  return base * (0.8 + Math.random() * 0.4);
}

function isPermanent(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500 && status !== 401 && status !== 429;
}

function isAuthFailure(error: unknown): boolean {
  return (error as { status?: number } | null)?.status === 401;
}

export interface FlushResult {
  pushed: number;
  failed: number;
  pausedForAuth: boolean;
}

export function flushOutbox(db: Db): Promise<FlushResult> {
  const running = inFlight.get(db);
  if (running) return running;
  const next = runFlush(db).finally(() => inFlight.delete(db));
  inFlight.set(db, next);
  return next;
}

async function pushOutboxItem(db: Db, item: OutboxRow): Promise<boolean> {
  for (const handler of [
    pushChangeRequestOutboxItem,
    pushChangeRequestCommentOutboxItem,
    pushDocumentOutboxItem,
    pushDrawingMarkupOutboxItem,
    pushDrawingMarkupCommentOutboxItem,
    pushLookAheadOutboxItem,
    pushMaterialOrderOutboxItem,
    pushMaterialApprovalOutboxItem,
    pushDailyLogOutboxItem,
    pushRfiOutboxItem,
  ]) {
    const result = await handler(db, item);
    if (result.handled) return result.pushed;
  }
  // Left pending, an unknown resource would be retried on every flush for
  // ever and never counted as a failure; deleted, it would vanish silently.
  throw new PermanentOutboxError(`Nothing on this device knows how to send "${item.resource}".`);
}

async function runFlush(db: Db): Promise<FlushResult> {
  const network = await NetInfo.fetch();
  if (network.isConnected === false || network.isInternetReachable === false) {
    return { pushed: 0, failed: 0, pausedForAuth: false };
  }
  const ownerId = getDbOwner(db);
  const now = Date.now();
  const due = await db
    .select()
    .from(outbox)
    .where(and(eq(outbox.status, "pending"), lte(outbox.nextAttemptAt, now)))
    .orderBy(asc(outbox.createdAt));

  let pushed = 0;
  let failed = 0;

  for (const queued of due) {
    if (ownerId && readCachedUser()?.id !== ownerId) {
      return { pushed, failed, pausedForAuth: true };
    }
    // Reconciliation may have changed a child's id, or the user may have
    // discarded an item while another request was in flight.
    const [item] = await db.select().from(outbox).where(eq(outbox.id, queued.id)).limit(1);
    if (!item || item.status !== "pending") continue;
    startSending(item.id);
    try {
      if (await pushOutboxItem(db, item)) pushed += 1;
    } catch (error) {
      if (isAuthFailure(error)) {
        return { pushed, failed, pausedForAuth: true };
      }

      const status = (error as { status?: number } | null)?.status;
      const transportFailure = status === 0 || (status === undefined && error instanceof Error &&
        /network|connection|internet|offline|timed out|failed to fetch|fetch failed|load failed/i.test(error.message));
      if (transportFailure) {
        await db.update(outbox).set({
          nextAttemptAt: Date.now() + 15_000,
          lastError: "Waiting for a connection. This change is saved on your device.",
        }).where(eq(outbox.id, item.id));
        return { pushed, failed, pausedForAuth: false };
      }

      const attempts = item.attempts + 1;
      const permanent = isPermanent(error) || attempts >= MAX_ATTEMPTS;
      await db
        .update(outbox)
        .set({
          attempts,
          status: permanent ? "failed" : "pending",
          nextAttemptAt: permanent ? 0 : Date.now() + nextDelayMs(attempts),
          lastError: error instanceof Error ? error.message : "Unknown error",
        })
        .where(eq(outbox.id, item.id));
      failed += 1;
    } finally {
      finishSending(item.id);
    }
  }

  return { pushed, failed, pausedForAuth: false };
}

export async function pendingCount(db: Db): Promise<number> {
  const rows = await db.select({ id: outbox.id }).from(outbox).where(eq(outbox.status, "pending"));
  return rows.length;
}

export const outboxQuery = (db: Db) => db.select().from(outbox);

// Only live creates hold a pull back. A failed one stays on the device with
// its pending flag set, which already keeps the pull from overwriting it.
export async function hasPendingCreates(db: Db, resource: string): Promise<boolean> {
  const rows = await db
    .select({ id: outbox.id })
    .from(outbox)
    .where(and(eq(outbox.resource, resource), eq(outbox.operation, "create"), eq(outbox.status, "pending")))
    .limit(1);
  return rows.length > 0;
}

/** Puts a failed item back in the queue as if it had never been tried. */
export async function retryOutboxItem(db: Db, id: string): Promise<void> {
  await db
    .update(outbox)
    .set({ status: "pending", attempts: 0, nextAttemptAt: 0, lastError: null })
    .where(eq(outbox.id, id));
}

/**
 * Drops a queued item and leaves its local record in a state the next server
 * pull can reconcile. A create that never reached the server is removed
 * locally, because the server has no such row; an update or decision simply
 * stops claiming to be pending, so the server's copy wins on the next pull; a
 * delete has nothing local left to undo and the pull restores the row.
 */
export async function discardOutboxItem(db: Db, id: string): Promise<void> {
  const [item] = await db.select().from(outbox).where(eq(outbox.id, id)).limit(1);
  if (!item) return;
  const table = OUTBOX_TABLES[item.resource];
  // A queued upload or voice note has a file staged on disk that nothing
  // else will ever clean up once its row is gone.
  const staged = item.operation === "create" ? await stagedFileFor(db, item) : null;
  await db.transaction((tx) => {
    if (table && item.operation === "create") {
      tx.run(sql`DELETE FROM ${table} WHERE id = ${item.entityId}`);
    } else if (table && item.operation !== "delete") {
      tx.run(sql`UPDATE ${table} SET is_pending_sync = 0 WHERE id = ${item.entityId}`);
    }
    tx.delete(outbox).where(eq(outbox.id, item.id)).run();
  });
  if (staged) discardStagedMedia(staged);
}

async function stagedFileFor(db: Db, item: OutboxRow): Promise<string | null> {
  if (item.resource === "documents") {
    const [row] = await db.select({ uri: documents.stagedUri }).from(documents).where(eq(documents.id, item.entityId)).limit(1);
    return row?.uri ?? null;
  }
  if (item.resource === "drawing-markup-comments") {
    const [row] = await db
      .select({ uri: drawingMarkupComments.stagedMediaUri })
      .from(drawingMarkupComments)
      .where(eq(drawingMarkupComments.id, item.entityId))
      .limit(1);
    return row?.uri ?? null;
  }
  return null;
}
