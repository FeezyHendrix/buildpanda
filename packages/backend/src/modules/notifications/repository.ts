import type { Knex } from "knex";
import type { NotificationPreferenceRow, NotificationRow, NotificationType } from "./types.ts";

export interface NewNotificationRecord {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  project_id: string | null;
}

export interface NewNotificationPreferenceRecord {
  id: string;
  user_id: string;
  type: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
}

export interface ListFilters {
  unreadOnly?: boolean;
  limit?: number;
}

export function notificationsRepository(db: Knex) {
  return {
    listForUser(userId: string, filters: ListFilters = {}): Promise<NotificationRow[]> {
      let query = db<NotificationRow>("notifications")
        .where({ user_id: userId })
        .orderBy("created_at", "desc")
        .limit(filters.limit ?? 50);
      if (filters.unreadOnly) {
        query = query.whereNull("read_at");
      }
      return query;
    },

    countUnread(userId: string): Promise<number> {
      return db<NotificationRow>("notifications")
        .where({ user_id: userId })
        .whereNull("read_at")
        .count<{ count: string }[]>({ count: "*" })
        .first()
        .then((row) => (row ? Number(row.count) : 0));
    },

    findById(id: string, userId: string): Promise<NotificationRow | undefined> {
      return db<NotificationRow>("notifications").where({ id, user_id: userId }).first();
    },

    markRead(id: string, userId: string): Promise<number> {
      return db<NotificationRow>("notifications")
        .where({ id, user_id: userId })
        .whereNull("read_at")
        .update({ read_at: new Date() });
    },

    markAllRead(userId: string): Promise<number> {
      return db<NotificationRow>("notifications")
        .where({ user_id: userId })
        .whereNull("read_at")
        .update({ read_at: new Date() });
    },

    async create(record: NewNotificationRecord): Promise<NotificationRow> {
      const [row] = await db<NotificationRow>("notifications").insert(record).returning("*");
      if (!row) throw new Error("Failed to insert notification");
      return row;
    },

    listPreferences(userId: string): Promise<NotificationPreferenceRow[]> {
      return db<NotificationPreferenceRow>("notification_preferences").where({ user_id: userId });
    },

    findPreference(
      userId: string,
      type: string,
    ): Promise<NotificationPreferenceRow | undefined> {
      return db<NotificationPreferenceRow>("notification_preferences")
        .where({ user_id: userId, type })
        .first();
    },

    async upsertPreference(record: NewNotificationPreferenceRecord): Promise<void> {
      await db("notification_preferences")
        .insert(record)
        .onConflict(["user_id", "type"])
        .merge({
          in_app_enabled: record.in_app_enabled,
          email_enabled: record.email_enabled,
          updated_at: new Date(),
        });
    },
  };
}

export type NotificationsRepository = ReturnType<typeof notificationsRepository>;
