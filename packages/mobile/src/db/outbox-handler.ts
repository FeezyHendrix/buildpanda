import type { Db } from "./client";
import type { OutboxRow } from "./schema";

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
