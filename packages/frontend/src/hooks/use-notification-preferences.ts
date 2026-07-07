import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationKeys } from "./query-keys";
import { notificationPreferencesApi } from "@/api/notification-preferences";
import type { SetNotificationPreferenceInput } from "@/api/notification-preferences";

export type { SetNotificationPreferenceInput };

export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: () => notificationPreferencesApi.list(),
  });
}

export function useSetNotificationPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SetNotificationPreferenceInput) => notificationPreferencesApi.set(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.preferences });
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
