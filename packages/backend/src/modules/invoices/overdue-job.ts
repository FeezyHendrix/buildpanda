import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";

export const INVOICE_OVERDUE_QUEUE = "invoice-overdue-sweep";

const INTERVAL_MS = 24 * 60 * 60 * 1_000;

export interface InvoiceOverdueJobData {
  _tick: number;
}

interface OverdueInvoiceRow {
  id: string;
  project_id: string;
  vendor_name: string;
  number: string | null;
  owner_id: string | null;
}

export async function runInvoiceOverdueSweep(
  db: Knex,
  queue?: QueueManager,
): Promise<void> {
  const notifications = notificationsService(notificationsRepository(db), queue);
  const today = new Date().toISOString().slice(0, 10);

  const overdue = await db<OverdueInvoiceRow>("project_invoices as i")
    .join("projects as p", "p.id", "i.project_id")
    .whereNotIn("i.status", ["Paid", "Draft"])
    .whereNotNull("i.due_date")
    .where("i.due_date", "<", today)
    .whereNull("i.overdue_notified_at")
    .select("i.id", "i.project_id", "i.vendor_name", "i.number", "p.owner_id");

  for (const invoice of overdue) {
    if (invoice.owner_id) {
      const ref = invoice.number ? `Invoice ${invoice.number}` : "An invoice";
      await notifications.notify(invoice.owner_id, "invoice_overdue", {
        title: "An invoice is overdue",
        body: `${ref} from ${invoice.vendor_name} is past its due date.`,
        projectId: invoice.project_id,
      });
    }
    await db("project_invoices")
      .where({ id: invoice.id })
      .update({ overdue_notified_at: new Date() });
  }
}

export function registerInvoiceOverdueWorker(
  db: Knex,
  manager: QueueManager,
): void {
  manager.startRepeating<InvoiceOverdueJobData>(
    INVOICE_OVERDUE_QUEUE,
    INTERVAL_MS,
    () => runInvoiceOverdueSweep(db, manager),
    { _tick: 0 },
  );
}
