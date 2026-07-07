import api from "./client";
import type { Notification, NotificationListResult } from "@/lib/project-types";

export const notificationsApi = {
  list: (filters?: { unreadOnly?: boolean; limit?: number }) =>
    api.get<NotificationListResult>("/notifications", filters ? { params: filters } : undefined).then((r) => r.data),

  markRead: (notificationId: string) =>
    api.post<Notification>(`/notifications/${notificationId}/read`).then((r) => r.data),

  markAllRead: () =>
    api.post<{ updated: number }>("/notifications/read-all").then((r) => r.data),
};
