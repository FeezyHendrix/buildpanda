import { and, asc, eq, lte } from "drizzle-orm";
import type { Db } from "./client";
import { pushChangeRequestOutboxItem } from "./outbox-change-requests";
import { pushDailyLogOutboxItem } from "./outbox-daily-logs";
import { pushDrawingMarkupOutboxItem } from "./outbox-drawing-markups";
import { pushLookAheadOutboxItem } from "./outbox-look-aheads";
import { pushMaterialApprovalOutboxItem } from "./outbox-material-approvals";
import { pushMaterialOrderOutboxItem } from "./outbox-material-orders";
import { pushRfiOutboxItem } from "./outbox-rfis";
import { outbox, type OutboxRow } from "./schema";

const MAX_ATTEMPTS = 8;

let inFlight: Promise<FlushResult> | null = null;

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
  if (inFlight) return inFlight;
  inFlight = runFlush(db).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function pushOutboxItem(db: Db, item: OutboxRow): Promise<boolean> {
  for (const handler of [
    pushChangeRequestOutboxItem,
    pushDrawingMarkupOutboxItem,
    pushLookAheadOutboxItem,
    pushMaterialOrderOutboxItem,
    pushMaterialApprovalOutboxItem,
    pushDailyLogOutboxItem,
    pushRfiOutboxItem,
  ]) {
    const result = await handler(db, item);
    if (result.handled) return result.pushed;
  }
  return false;
}

async function runFlush(db: Db): Promise<FlushResult> {
  const now = Date.now();
  const due = await db
    .select()
    .from(outbox)
    .where(and(eq(outbox.status, "pending"), lte(outbox.nextAttemptAt, now)))
    .orderBy(asc(outbox.createdAt));

  let pushed = 0;
  let failed = 0;

  for (const item of due) {
    try {
      if (await pushOutboxItem(db, item)) pushed += 1;
    } catch (error) {
      if (isAuthFailure(error)) {
        return { pushed, failed, pausedForAuth: true };
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
    }
  }

  return { pushed, failed, pausedForAuth: false };
}

export async function pendingCount(db: Db): Promise<number> {
  const rows = await db.select({ id: outbox.id }).from(outbox).where(eq(outbox.status, "pending"));
  return rows.length;
}

export const outboxQuery = (db: Db) => db.select().from(outbox);

export async function hasPendingCreates(db: Db, resource: string): Promise<boolean> {
  const rows = await db
    .select({ id: outbox.id })
    .from(outbox)
    .where(and(eq(outbox.resource, resource), eq(outbox.operation, "create")))
    .limit(1);
  return rows.length > 0;
}
