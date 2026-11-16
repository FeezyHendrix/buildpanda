import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService, type NotificationsService } from "../notifications/service.ts";
import { materialLedgerNotificationQueue } from "../materials-ledger/notification-queue.ts";
import type { FieldToolContext } from "./tool-types.ts";

export function collaborationNotifications(context: FieldToolContext) {
  const queue = materialLedgerNotificationQueue(context.db, context.queue);
  const service = notificationsService(notificationsRepository(context.db), queue);
  const pending: Promise<void>[] = [];
  return {
    queue,
    notifications: { ...service, notify(...args: Parameters<NotificationsService["notify"]>) {
      const result = service.notify(...args);
      pending.push(result);
      return result;
    } },
    // Canonical services fan out notifications without awaiting them; finish their
    // database writes before the caller commits, while external queues stay deferred.
    flush: () => Promise.all(pending),
  };
}
