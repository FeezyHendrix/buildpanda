import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";

export const KEY_DATE_REMINDER_QUEUE = "key-date-reminder-sweep";

const INTERVAL_MS = 24 * 60 * 60 * 1_000;
const APPROACHING_WINDOW_DAYS = 7;

export interface KeyDateReminderJobData {
  _tick: number;
}

interface KeyDateRow {
  id: string;
  project_id: string;
  label: string;
  owner_id: string | null;
}

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function runKeyDateReminderSweep(
  db: Knex,
  queue?: QueueManager,
): Promise<void> {
  const notifications = notificationsService(notificationsRepository(db), queue);
  const today = new Date().toISOString().slice(0, 10);
  const horizon = isoDateOffset(APPROACHING_WINDOW_DAYS);

  const approaching = await db<KeyDateRow>("key_dates as k")
    .join("projects as p", "p.id", "k.project_id")
    .where("k.status", "Upcoming")
    .whereNotNull("k.target_date")
    .where("k.target_date", ">=", today)
    .where("k.target_date", "<=", horizon)
    .whereNull("k.approaching_notified_at")
    .select("k.id", "k.project_id", "k.label", "p.owner_id");

  for (const keyDate of approaching) {
    if (keyDate.owner_id) {
      await notifications.notify(keyDate.owner_id, "key_date_approaching", {
        title: "A key date is approaching",
        body: `${keyDate.label} is due within ${APPROACHING_WINDOW_DAYS} days.`,
        projectId: keyDate.project_id,
      });
    }
    await db("key_dates")
      .where({ id: keyDate.id })
      .update({ approaching_notified_at: new Date() });
  }

  const missed = await db<KeyDateRow>("key_dates as k")
    .join("projects as p", "p.id", "k.project_id")
    .whereIn("k.status", ["Upcoming", "Missed"])
    .whereNotNull("k.target_date")
    .where("k.target_date", "<", today)
    .whereNull("k.missed_notified_at")
    .select("k.id", "k.project_id", "k.label", "p.owner_id");

  for (const keyDate of missed) {
    if (keyDate.owner_id) {
      await notifications.notify(keyDate.owner_id, "key_date_missed", {
        title: "A key date was missed",
        body: `${keyDate.label} passed its target date.`,
        projectId: keyDate.project_id,
      });
    }
    await db("key_dates")
      .where({ id: keyDate.id })
      .update({ missed_notified_at: new Date() });
  }
}

export function registerKeyDateReminderWorker(
  db: Knex,
  manager: QueueManager,
): void {
  manager.startRepeating<KeyDateReminderJobData>(
    KEY_DATE_REMINDER_QUEUE,
    INTERVAL_MS,
    () => runKeyDateReminderSweep(db, manager),
    { _tick: 0 },
  );
}
