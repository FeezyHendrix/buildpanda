import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { rfisRepository } from "./repository.ts";
import { rfisService } from "./service.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";

export const RFI_REMINDER_QUEUE = "rfi-reminder-sweep";

const INTERVAL_MS = 60 * 60 * 1_000;

export interface RfiReminderJobData {
  _tick: number;
}

export async function runRfiReminderSweep(db: Knex): Promise<void> {
  const service = rfisService(rfisRepository(db));
  const notifications = notificationsService(notificationsRepository(db));
  const today = new Date().toISOString().slice(0, 10);

  const due = await service.dueForReminder(today);
  for (const rfi of due) {
    if (!rfi.ballInCourtId) continue;
    const overdue = rfi.dueDate !== null && rfi.dueDate.slice(0, 10) < today;
    await notifications.notify(rfi.ballInCourtId, "rfi_due", {
      title: overdue ? `RFI-${rfi.number} overdue` : `RFI-${rfi.number} due today`,
      body: rfi.subject,
      projectId: rfi.projectId,
    });
    await service.markReminded(rfi.id, today);
  }
}

export function registerRfiReminderWorker(db: Knex, manager: QueueManager): void {
  manager.startRepeating<RfiReminderJobData>(
    RFI_REMINDER_QUEUE,
    INTERVAL_MS,
    () => runRfiReminderSweep(db),
    { _tick: 0 },
  );
}
