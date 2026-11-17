import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { config } from "../../config/index.ts";
import { sendEmail } from "../../lib/mail.ts";
import { rfiBallInCourtEmail } from "../../lib/email-templates.ts";
import { afterCommit } from "../materials-ledger/notification-queue.ts";
import { transactionalNotifications } from "../notifications/transactional.ts";
import { buildChangeServices } from "../change-requests/wiring.ts";
import { rfisRepository } from "./repository.ts";
import { rfisService } from "./service.ts";
import type { Rfi } from "./types.ts";

export function buildRfiServices(db: Knex, queue?: Pick<QueueManager, "enqueue">) {
  const notifications = transactionalNotifications(db, queue);
  const changes = buildChangeServices(db, queue);
  const service = rfisService(rfisRepository(db), {
    changeRequests: changes.service, notifications: notifications.service,
  });
  async function sendBallInCourtEmail(rfi: Rfi, projectName: string, actorEmail: string): Promise<void> {
    if (!rfi.ballInCourtEmail) return;
    if (rfi.ballInCourtEmail.toLowerCase() === actorEmail.toLowerCase()) return;

    const url = `${config.mail.appUrl.replace(/\/+$/, "")}/project/${rfi.projectId}/rfis`;
    const { subject, html } = rfiBallInCourtEmail({
      recipientName: rfi.ballInCourtName ?? rfi.ballInCourtEmail,
      projectName,
      rfiNumber: rfi.number,
      rfiSubject: rfi.subject,
      question: rfi.question,
      url,
    });
    const recipient = rfi.ballInCourtEmail;
    afterCommit(db, () => sendEmail({
      to: recipient,
      toName: rfi.ballInCourtName ?? undefined,
      subject,
      html,
    }).catch(() => undefined));
  }

  return { service, sendBallInCourtEmail, async flush() { await notifications.flush(); await changes.flush(); } };
}
