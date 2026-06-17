import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { sendEmail } from "../../lib/mail.ts";
import { logger } from "../../lib/logger.ts";
import { captureBug } from "../../lib/sentry.ts";
import { buildNotificationEmail } from "./email-content.ts";
import type { NotificationType } from "./types.ts";

export const NOTIFICATION_EMAIL_QUEUE = "notification-email";

export interface NotificationEmailJobData {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  projectId: string | null;
  ctaUrl: string | null;
}

interface RecipientRow {
  name: string;
  email: string;
}

interface PrefRow {
  email_enabled: boolean;
}

export async function runNotificationEmail(
  db: Knex,
  data: NotificationEmailJobData,
): Promise<void> {
  const user = await db<RecipientRow>("user")
    .select("name", "email")
    .where({ id: data.userId })
    .first();
  if (!user?.email) {
    logger.warn({ userId: data.userId, type: data.type }, "[notif-email] recipient has no email");
    return;
  }

  const pref = await db<PrefRow>("notification_preferences")
    .select("email_enabled")
    .where({ user_id: data.userId, type: data.type })
    .first();
  if (pref && !pref.email_enabled) return;

  const { subject, html } = buildNotificationEmail({
    recipientName: user.name,
    type: data.type,
    title: data.title,
    body: data.body,
    projectId: data.projectId,
    ctaUrl: data.ctaUrl,
  });

  try {
    await sendEmail({ to: user.email, toName: user.name, subject, html });
  } catch (error) {
    logger.error(
      { err: error, userId: data.userId, type: data.type },
      "[notif-email] send failed",
    );
    captureBug(error, {
      tags: { area: "notifications", channel: "email", notificationType: data.type },
      extra: { userId: data.userId },
    });
  }
}

export function registerNotificationEmailWorker(
  db: Knex,
  manager: QueueManager,
): void {
  manager.registerProcessor<NotificationEmailJobData>(
    NOTIFICATION_EMAIL_QUEUE,
    (jobData) => runNotificationEmail(db, jobData),
  );
}
