import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { actionItemsRepository } from "./repository.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";

export const ACTION_ITEM_REMINDER_QUEUE = "action-item-reminder-sweep";

const INTERVAL_MS = 60 * 60 * 1_000;

export interface ReminderJobData {
  _tick: number;
}

export async function runReminderSweep(db: Knex): Promise<void> {
  const repo = actionItemsRepository(db);
  const notifications = notificationsService(notificationsRepository(db));
  const today = new Date().toISOString().slice(0, 10);

  const due = await repo.listDueForReminder(today);
  for (const item of due) {
    if (!item.assignee_id) continue;
    const dueStr = item.due_date ? new Date(item.due_date).toISOString().slice(0, 10) : null;
    const overdue = dueStr !== null && dueStr < today;
    await notifications.notify(item.assignee_id, "action_item_due", {
      title: overdue ? "Action item overdue" : "Action item due today",
      body: item.title,
      projectId: item.project_id,
    });
    await repo.markReminded(item.id);
  }
}

export function registerActionItemReminderWorker(db: Knex, manager: QueueManager): void {
  manager.startRepeating<ReminderJobData>(
    ACTION_ITEM_REMINDER_QUEUE,
    INTERVAL_MS,
    () => runReminderSweep(db),
    { _tick: 0 },
  );
}
