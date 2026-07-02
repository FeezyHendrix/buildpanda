import type { Knex } from "knex";
import webpush from "web-push";
import type { QueueManager } from "../../lib/queue/index.ts";
import { config } from "../../config/index.ts";
import { logger } from "../../lib/logger.ts";
import { captureBug } from "../../lib/sentry.ts";
import { buildNotificationPush } from "./email-content.ts";
import type { NotificationType, PushSubscriptionRow } from "./types.ts";

export const NOTIFICATION_PUSH_QUEUE = "notification-push";

export interface NotificationPushJobData {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  projectId: string | null;
  ctaUrl: string | null;
}

interface PrefRow {
  email_enabled: boolean;
}

export function isPushConfigured(): boolean {
  return Boolean(config.push.vapidPublicKey && config.push.vapidPrivateKey);
}

// VAPID details are process-wide state in web-push; set them once, lazily, so
// the module can be imported (e.g. for the queue constant) without keys.
let vapidConfigured = false;
function ensureVapidDetails(): void {
  if (vapidConfigured) return;
  webpush.setVapidDetails(
    config.push.contact || `mailto:${config.mail.replyToAddress}`,
    config.push.vapidPublicKey,
    config.push.vapidPrivateKey,
  );
  vapidConfigured = true;
}

export async function runNotificationPush(
  db: Knex,
  data: NotificationPushJobData,
): Promise<void> {
  if (!isPushConfigured()) {
    // Mirror mail's dev degrade: log instead of send when keys are absent.
    logger.warn(
      { userId: data.userId, type: data.type, title: data.title },
      "[notif-push] VAPID keys not set — skipping send",
    );
    return;
  }
  ensureVapidDetails();

  // Preferences have in-app and email channels but no push channel yet; push
  // reuses the email preference as its gate, re-checked here exactly like the
  // email worker re-checks it at delivery time.
  const pref = await db<PrefRow>("notification_preferences")
    .select("email_enabled")
    .where({ user_id: data.userId, type: data.type })
    .first();
  if (pref && !pref.email_enabled) return;

  const subscriptions = await db<PushSubscriptionRow>("push_subscriptions").where({
    user_id: data.userId,
  });
  if (subscriptions.length === 0) return;

  const payload = JSON.stringify(
    buildNotificationPush({
      title: data.title,
      body: data.body,
      projectId: data.projectId,
      ctaUrl: data.ctaUrl,
    }),
  );

  const sentIds: string[] = [];
  const staleIds: string[] = [];
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      sentIds.push(sub.id);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        // The push service says this registration is gone — drop it.
        staleIds.push(sub.id);
        logger.info(
          { userId: data.userId, subscriptionId: sub.id, statusCode },
          "[notif-push] subscription expired — deleting",
        );
      } else {
        logger.error(
          { err: error, userId: data.userId, subscriptionId: sub.id, type: data.type },
          "[notif-push] send failed",
        );
        captureBug(error, {
          tags: { area: "notifications", channel: "push", notificationType: data.type },
          extra: { userId: data.userId, subscriptionId: sub.id },
        });
      }
    }
  }

  await Promise.all([
    sentIds.length > 0
      ? db("push_subscriptions").whereIn("id", sentIds).update({ last_used_at: new Date() })
      : Promise.resolve(),
    staleIds.length > 0
      ? db("push_subscriptions").whereIn("id", staleIds).delete()
      : Promise.resolve(),
  ]);

  if (sentIds.length > 0) {
    logger.info(
      { userId: data.userId, type: data.type, sent: sentIds.length, expired: staleIds.length },
      "[notif-push] Sent",
    );
  }
}

export function registerNotificationPushWorker(db: Knex, manager: QueueManager): void {
  manager.registerProcessor<NotificationPushJobData>(
    NOTIFICATION_PUSH_QUEUE,
    (jobData) => runNotificationPush(db, jobData),
  );
}
