import { eq } from "drizzle-orm";
import type { Db } from "./client";
import { outbox, type OutboxRow } from "./schema";

export interface OutboxHandlerResult {
  handled: boolean;
  pushed: boolean;
}

export type OutboxHandler = (db: Db, item: OutboxRow) => Promise<OutboxHandlerResult>;

export const skipped: OutboxHandlerResult = { handled: false, pushed: false };

export function done(pushed: boolean): OutboxHandlerResult {
  return { handled: true, pushed };
}

/**
 * Thrown by a handler when a queued row can never be accepted as it stands —
 * a field the API requires is missing, or no handler knows the resource. It
 * carries a 4xx-shaped status so the flush marks the row failed at once
 * instead of retrying it eight times over the next hours.
 */
export class PermanentOutboxError extends Error {
  readonly status = 422;

  constructor(message: string) {
    super(message);
    this.name = "PermanentOutboxError";
  }
}

/** The record behind a queued item is gone, so there is nothing left to send. */
export async function dropItem(db: Db, item: OutboxRow): Promise<OutboxHandlerResult> {
  await db.delete(outbox).where(eq(outbox.id, item.id));
  return done(false);
}

/** The push landed: the queued item has done its job. */
export async function finishItem(db: Db, item: OutboxRow): Promise<OutboxHandlerResult> {
  await db.delete(outbox).where(eq(outbox.id, item.id));
  return done(true);
}

/**
 * A refusal the server will repeat however often the item is retried: any
 * 4xx except 401 (sign in again) and 429 (slow down).
 */
export function isPermanent(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500 && status !== 401 && status !== 429;
}
