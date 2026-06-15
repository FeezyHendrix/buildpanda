import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";

export const PERMIT_EXPIRY_QUEUE = "permit-expiry-sweep";

const INTERVAL_MS = 24 * 60 * 60 * 1_000;
const EXPIRING_WINDOW_DAYS = 30;

export interface PermitExpiryJobData {
  _tick: number;
}

interface PermitRow {
  id: string;
  project_id: string;
  title: string;
  owner_id: string | null;
}

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function runPermitExpirySweep(
  db: Knex,
  queue?: QueueManager,
): Promise<void> {
  const notifications = notificationsService(notificationsRepository(db), queue);
  const today = new Date().toISOString().slice(0, 10);
  const horizon = isoDateOffset(EXPIRING_WINDOW_DAYS);

  const expiring = await db<PermitRow>("permits as pm")
    .join("projects as p", "p.id", "pm.project_id")
    .where("pm.status", "Approved")
    .whereNotNull("pm.expiry_date")
    .where("pm.expiry_date", ">=", today)
    .where("pm.expiry_date", "<=", horizon)
    .whereNull("pm.expiring_notified_at")
    .select("pm.id", "pm.project_id", "pm.title", "p.owner_id");

  for (const permit of expiring) {
    if (permit.owner_id) {
      await notifications.notify(permit.owner_id, "permit_expiring", {
        title: "A permit is expiring soon",
        body: `${permit.title} expires within ${EXPIRING_WINDOW_DAYS} days.`,
        projectId: permit.project_id,
      });
    }
    await db("permits")
      .where({ id: permit.id })
      .update({ expiring_notified_at: new Date() });
  }

  const expired = await db<PermitRow>("permits as pm")
    .join("projects as p", "p.id", "pm.project_id")
    .whereNotNull("pm.expiry_date")
    .where("pm.expiry_date", "<", today)
    .whereIn("pm.status", ["Approved", "Expired"])
    .whereNull("pm.expired_notified_at")
    .select("pm.id", "pm.project_id", "pm.title", "p.owner_id");

  for (const permit of expired) {
    if (permit.owner_id) {
      await notifications.notify(permit.owner_id, "permit_expired", {
        title: "A permit has expired",
        body: `${permit.title} has passed its expiry date.`,
        projectId: permit.project_id,
      });
    }
    await db("permits")
      .where({ id: permit.id })
      .update({ expired_notified_at: new Date() });
  }
}

export function registerPermitExpiryWorker(
  db: Knex,
  manager: QueueManager,
): void {
  manager.startRepeating<PermitExpiryJobData>(
    PERMIT_EXPIRY_QUEUE,
    INTERVAL_MS,
    () => runPermitExpirySweep(db, manager),
    { _tick: 0 },
  );
}
