import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { materialLedgerNotificationQueue } from "../materials-ledger/notification-queue.ts";
import { notificationsRepository } from "./repository.ts";
import { notificationsService } from "./service.ts";

/** Existing services can notify without awaiting; callers must drain before committing their records. */
export function transactionalNotifications(db: Knex, queue?: Pick<QueueManager, "enqueue">) {
  const pending: Promise<void>[] = [];
  const base = notificationsService(notificationsRepository(db), materialLedgerNotificationQueue(db, queue));
  if (!db.isTransaction) return { service: base, async flush() {} };
  return {
    service: { ...base, notify(...args: Parameters<typeof base.notify>) {
      const operation = base.notify(...args);
      pending.push(operation);
      return operation;
    } },
    async flush() { await Promise.allSettled(pending.splice(0)); },
  };
}
