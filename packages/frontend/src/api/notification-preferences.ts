import api from "./client";
import type { NotificationPreference, NotificationType } from "@/lib/project-types";

export interface SetNotificationPreferenceInput {
  type: NotificationType;
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
}

export const notificationPreferencesApi = {
  list: () => api.get<NotificationPreference[]>("/notifications/preferences").then((r) => r.data),
  
  set: (input: SetNotificationPreferenceInput) =>
    api.put<NotificationPreference>("/notifications/preferences", input).then((r) => r.data),
};
