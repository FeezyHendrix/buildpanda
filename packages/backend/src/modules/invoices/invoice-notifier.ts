import type { Knex } from "knex";
import type { NotificationsService } from "../notifications/service.ts";
import type { NotificationType } from "../notifications/types.ts";
import type { InvoiceEventType, InvoiceRow } from "./types.ts";

/**
 * Who hears about a certificate moving.
 *
 * A finance event reaches the project owner and every participant who may read
 * the finance surface — the people whose job the certificate is. It never
 * reaches the actor themselves, and a notification failure never fails the
 * action that caused it: the certificate is the record, the notice is courtesy.
 */

const TITLES: Partial<Record<InvoiceEventType, { type: NotificationType; title: string }>> = {
  sent: { type: "invoice_sent", title: "A certificate was issued" },
  queried: { type: "invoice_queried", title: "An invoice was queried by the client" },
  approved: { type: "invoice_approved", title: "An invoice was approved" },
  voided: { type: "invoice_voided", title: "A certificate was voided" },
  payment_recorded: { type: "invoice_paid", title: "A payment was recorded" },
};

export function invoiceNotifier(notifications: NotificationsService, db: Knex) {
  /** The owner plus every participant whose grants include reading finances. */
  async function audience(projectId: string, actorId: string): Promise<string[]> {
    const [project, participants] = await Promise.all([
      db("projects").where({ id: projectId }).select("owner_id").first<{ owner_id: string | null }>(),
      db("project_participants")
        .where({ project_id: projectId, status: "active" })
        .whereNotNull("user_id")
        .select<{ user_id: string; role: string; grants: Record<string, string[]> | null }[]>(
          "user_id",
          "role",
          "grants",
        ),
    ]);
    const ids = new Set<string>();
    if (project?.owner_id) ids.add(project.owner_id);
    for (const participant of participants) {
      const grants = participant.grants;
      const reads = grants ? (grants["finances"] ?? []).includes("view") : participant.role !== "guest";
      if (reads) ids.add(participant.user_id);
    }
    ids.delete(actorId);
    return [...ids];
  }

  return {
    statusChanged(
      projectId: string,
      invoice: InvoiceRow,
      type: InvoiceEventType,
      actor: { id: string; name: string },
      reason: string | null,
    ): void {
      const meta = TITLES[type];
      if (!meta) return;
      const label = invoice.number ?? invoice.trade;
      const body = reason ? `${label} — ${reason}` : label;
      void audience(projectId, actor.id)
        .then((recipients) =>
          Promise.all(
            recipients.map((userId) =>
              notifications.notify(userId, meta.type, { title: meta.title, body, projectId }),
            ),
          ),
        )
        .catch(() => undefined);
    },

    /** A receipt that landed after the due date is its own signal. */
    paidLate(
      projectId: string,
      invoice: InvoiceRow,
      daysLate: number,
      actor: { id: string; name: string },
    ): void {
      void audience(projectId, actor.id)
        .then((recipients) =>
          Promise.all(
            recipients.map((userId) =>
              notifications.notify(userId, "invoice_paid_late", {
                title: "A payment was recorded late",
                body: `${invoice.number ?? invoice.trade} — paid ${daysLate} day${daysLate === 1 ? "" : "s"} after the due date`,
                projectId,
              }),
            ),
          ),
        )
        .catch(() => undefined);
    },
  };
}

export type InvoiceNotifier = ReturnType<typeof invoiceNotifier>;
