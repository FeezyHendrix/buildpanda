import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { notificationKeys } from "./query-keys";
import type {
  Notification,
  NotificationListResult,
} from "@/lib/project-mock-data";

const POLL_INTERVAL_MS = 60_000;

export function useNotifications(filters?: { unreadOnly?: boolean; limit?: number }) {
  return useQuery({
    queryKey: notificationKeys.list(filters),
    queryFn: async () => {
      const { data } = await api.get<NotificationListResult>(
        "/notifications",
        filters ? { params: filters } : undefined,
      );
      return data;
    },
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data } = await api.post<Notification>(
        `/notifications/${notificationId}/read`,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ updated: number }>(
        "/notifications/read-all",
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
