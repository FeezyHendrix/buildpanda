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
