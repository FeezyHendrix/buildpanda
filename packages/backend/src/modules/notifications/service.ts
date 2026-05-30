import { NotFoundError } from "../../lib/errors.ts";
import type {
  ListFilters,
  NotificationsRepository,
} from "./repository.ts";
import type { Notification, NotificationRow } from "./types.ts";

export interface NotificationListResult {
  notifications: Notification[];
  unreadCount: number;
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

export function notificationsService(repository: NotificationsRepository) {
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
  };
}

export type NotificationsService = ReturnType<typeof notificationsService>;
