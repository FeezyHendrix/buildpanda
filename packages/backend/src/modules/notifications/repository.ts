import type { Knex } from "knex";
import type {
  NotificationPreferenceRow,
  NotificationRow,
  NotificationType,
  PushSubscriptionRow,
} from "./types.ts";

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

export interface NewPushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
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

    // A push endpoint is globally unique per browser registration, so the
    // upsert keys on it — re-subscribing (or another account signing in on the
    // same device) takes over the endpoint instead of duplicating it.
    async upsertPushSubscription(record: NewPushSubscriptionRecord): Promise<void> {
      await db("push_subscriptions")
        .insert(record)
        .onConflict("endpoint")
        .merge({
          user_id: record.user_id,
          p256dh: record.p256dh,
          auth: record.auth,
          user_agent: record.user_agent,
        });
    },

    deletePushSubscription(userId: string, endpoint: string): Promise<number> {
      return db<PushSubscriptionRow>("push_subscriptions")
        .where({ user_id: userId, endpoint })
        .delete();
    },

    listPushSubscriptions(userId: string): Promise<PushSubscriptionRow[]> {
      return db<PushSubscriptionRow>("push_subscriptions").where({ user_id: userId });
    },
  };
}

export type NotificationsRepository = ReturnType<typeof notificationsRepository>;
