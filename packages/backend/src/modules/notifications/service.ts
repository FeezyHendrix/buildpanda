import { NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { QueueManager } from "../../lib/queue/index.ts";
import type { ListFilters, NotificationsRepository } from "./repository.ts";
import {
  NOTIFICATION_EMAIL_QUEUE,
  type NotificationEmailJobData,
} from "./email-job.ts";
import {
  NOTIFICATION_TYPES,
  type Notification,
  type NotificationPreference,
  type NotificationRow,
  type NotificationType,
} from "./types.ts";

export interface NotificationListResult {
  notifications: Notification[];
  unreadCount: number;
}

export interface NotifyInput {
  title: string;
  body: string;
  projectId?: string | null;
  ctaUrl?: string | null;
}

export interface PreferencePatch {
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    projectId: row.project_id,
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function notificationsService(
  repository: NotificationsRepository,
  queue?: QueueManager,
) {
  return {
    async list(userId: string, filters: ListFilters): Promise<NotificationListResult> {
      const [rows, unread] = await Promise.all([
        repository.listForUser(userId, filters),
        repository.countUnread(userId),
      ]);
      return {
        notifications: rows.map(toNotification),
        unreadCount: unread,
      };
    },

    async markRead(userId: string, id: string): Promise<Notification> {
      const existing = await repository.findById(id, userId);
      if (!existing) throw new NotFoundError("Notification");
      if (!existing.read_at) {
        await repository.markRead(id, userId);
      }
      const updated = await repository.findById(id, userId);
      if (!updated) throw new NotFoundError("Notification");
      return toNotification(updated);
    },

    async markAllRead(userId: string): Promise<{ updated: number }> {
      const updated = await repository.markAllRead(userId);
      return { updated };
    },

    async notify(userId: string, type: NotificationType, input: NotifyInput): Promise<void> {
      const pref = await repository.findPreference(userId, type);
      const inAppOn = !pref || pref.in_app_enabled;
      const emailOn = !pref || pref.email_enabled;

      if (inAppOn) {
        await repository.create({
          id: generateId("ntf"),
          user_id: userId,
          type,
          title: input.title,
          body: input.body,
          project_id: input.projectId ?? null,
        });
      }

      if (emailOn && queue) {
        const jobData: NotificationEmailJobData = {
          userId,
          type,
          title: input.title,
          body: input.body,
          projectId: input.projectId ?? null,
          ctaUrl: input.ctaUrl ?? null,
        };
        await queue
          .enqueue(NOTIFICATION_EMAIL_QUEUE, "send", jobData)
          .catch(() => undefined);
      }
    },

    async getPreferences(userId: string): Promise<NotificationPreference[]> {
      const rows = await repository.listPreferences(userId);
      const byType = new Map(rows.map((r) => [r.type, r]));
      return NOTIFICATION_TYPES.map((t) => {
        const row = byType.get(t.type);
        return {
          type: t.type,
          label: t.label,
          group: t.group,
          inAppEnabled: row ? row.in_app_enabled : true,
          emailEnabled: row ? row.email_enabled : true,
        };
      });
    },

    async setPreference(
      userId: string,
      type: NotificationType,
      patch: PreferencePatch,
    ): Promise<NotificationPreference> {
      const existing = await repository.findPreference(userId, type);
      const inAppEnabled = patch.inAppEnabled ?? existing?.in_app_enabled ?? true;
      const emailEnabled = patch.emailEnabled ?? existing?.email_enabled ?? true;
      await repository.upsertPreference({
        id: existing?.id ?? generateId("np"),
        user_id: userId,
        type,
        in_app_enabled: inAppEnabled,
        email_enabled: emailEnabled,
      });
      const meta = NOTIFICATION_TYPES.find((t) => t.type === type);
      if (!meta) throw new NotFoundError("Notification type");
      return { type, label: meta.label, group: meta.group, inAppEnabled, emailEnabled };
    },
  };
}

export type NotificationsService = ReturnType<typeof notificationsService>;
