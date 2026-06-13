import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { notificationKeys } from "./query-keys";
import type { NotificationPreference, NotificationType } from "@/lib/project-types";

export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: async () => {
      const { data } = await api.get<NotificationPreference[]>("/notifications/preferences");
      return data;
    },
  });
}

export interface SetNotificationPreferenceInput {
  type: NotificationType;
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
}

export function useSetNotificationPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SetNotificationPreferenceInput) => {
      const { data } = await api.put<NotificationPreference>("/notifications/preferences", input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.preferences });
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
