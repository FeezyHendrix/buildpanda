import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { ApiError } from "@/api/client";
import { messagingApi } from "@/api/messaging";
import { useFieldSession } from "@/lib/field-session";
import { usePersistentQuery } from "@/lib/persistent-query";
import { useSyncState } from "@/lib/sync-provider";
import { visibleChannels } from "@/lib/messaging";

type Snapshot<T> = { data: T; denied?: false } | { data: null; denied: true };

/** Cache denials too: a revoked conversation must not reappear when offline. */
function useMessagingQuery<T>(key: readonly string[], queryFn: () => Promise<T>, enabled: boolean, poll: number | false = false) {
  const { storageOwnerId, organizationId } = useFieldSession();
  const { isOnline } = useSyncState();
  const query = usePersistentQuery<Snapshot<T>>({
    queryKey: ["messaging", organizationId, ...key], ownerId: storageOwnerId,
    enabled: enabled && isOnline,
    refetchInterval: enabled && isOnline ? poll : false,
    queryFn: async () => {
      try { return { data: await queryFn() }; }
      catch (error) {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return { data: null, denied: true };
        throw error;
      }
    },
  });
  return { ...query, data: query.data?.data ?? undefined, accessDenied: query.data?.denied === true, isPending: query.isPending && isOnline };
}

export function useMessagingChannels() {
  const { projectId, organizationId } = useFieldSession();
  const project = useMessagingQuery(["project", projectId ?? ""], () => messagingApi.projectChannels(projectId!), Boolean(projectId), 30_000);
  const all = useMessagingQuery(["channels"], messagingApi.channels, Boolean(organizationId), 30_000);
  const channels = useMemo(() => visibleChannels(
    (all.data ?? []).filter((channel) => !project.accessDenied || channel.type !== "project" || channel.projectId !== projectId),
    project.data ?? [], projectId, organizationId,
  ), [all.data, project.data, project.accessDenied, projectId, organizationId]);
  return {
    channels, isPending: project.isPending || all.isPending,
    error: project.error ?? all.error, accessDenied: all.accessDenied || project.accessDenied,
    unread: channels.reduce((count, channel) => count + (channel.muted ? 0 : channel.unreadCount), 0),
    refetch: () => Promise.all([project.refetch(), all.refetch()]),
  };
}

export function useMessagingChannel(channelId: string, active = true) {
  return useMessagingQuery(["channel", channelId], () => messagingApi.channel(channelId), Boolean(channelId) && active, 30_000);
}

export function useChannelMembers(channelId: string, active = true) {
  return useMessagingQuery(["members", channelId], () => messagingApi.members(channelId), Boolean(channelId) && active);
}

export function useChannelMessages(channelId: string, active: boolean) {
  return useMessagingQuery(["messages", channelId], () => messagingApi.messages(channelId), Boolean(channelId) && active, 5_000);
}

export function useMessageThread(threadId: string | undefined, active: boolean) {
  return useMessagingQuery(["thread", threadId ?? ""], () => messagingApi.thread(threadId!), Boolean(threadId) && active, 5_000);
}

export function useThreadRoot(threadId: string | undefined, active: boolean) {
  return useMessagingQuery(["message", threadId ?? ""], () => messagingApi.message(threadId!), Boolean(threadId) && active, 5_000);
}

export function useMessagingActions(channelId?: string) {
  const client = useQueryClient();
  const { organizationId } = useFieldSession();
  const { isOnline } = useSyncState();
  const invalidate = () => client.invalidateQueries({ queryKey: ["messaging", organizationId] });
  const requireConnection = () => { if (!isOnline) throw new Error("Reconnect to send. Your draft is saved on this device."); };
  const send = useMutation({
    mutationFn: ({ body, threadId }: { body: string; threadId?: string }) => {
      requireConnection();
      return messagingApi.send(channelId!, body, threadId);
    },
    networkMode: "always", retry: false, onSuccess: invalidate,
  });
  const openDm = useMutation({
    mutationFn: (userId: string) => { requireConnection(); return messagingApi.openDm(userId); },
    networkMode: "always", retry: false, onSuccess: invalidate,
  });
  const markRead = useMutation({
    mutationFn: (messageId: string) => messagingApi.markRead(channelId!, messageId),
    networkMode: "always", retry: false,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["messaging", organizationId, "channels"] });
      void client.invalidateQueries({ queryKey: ["messaging", organizationId, "project"] });
    },
  });
  return { send, openDm, markRead };
}
