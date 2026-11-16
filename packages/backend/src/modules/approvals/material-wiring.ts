import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { materialLedgerNotificationQueue } from "../materials-ledger/notification-queue.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { materialApprovalsRepository } from "./material-repository.ts";
import { materialApprovalsService } from "./material-service.ts";

export function buildMaterialApprovalsService(db: Knex, queue?: Pick<QueueManager, "enqueue">) {
  return materialApprovalsService(materialApprovalsRepository(db), {
    notifications: notificationsService(notificationsRepository(db), materialLedgerNotificationQueue(db, queue)),
  });
}
