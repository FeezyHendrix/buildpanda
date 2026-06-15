import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { channelKeys, messageKeys } from "./query-keys";
import type { Channel, ChatMessage, ChannelMemberLite } from "@/lib/project-types";

export function useProjectChannels(projectId: string | undefined | null) {
  return useQuery({
    queryKey: channelKeys.project(projectId!),
    queryFn: () =>
      api.get<Channel[]>(`/projects/${projectId}/channels`).then((r) => r.data),
    enabled: Boolean(projectId),
  });
}

export function useChannelMessages(channelId: string | undefined | null) {
  return useInfiniteQuery({
    queryKey: messageKeys.list(channelId!),
    queryFn: ({ pageParam }) =>
      api.get<ChatMessage[]>(`/channels/${channelId}/messages`, {
        params: { before: pageParam },
      }).then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: () => undefined,
    getPreviousPageParam: (firstPage) => firstPage.length > 0 ? firstPage[0]!.id : undefined,
    enabled: Boolean(channelId),
    refetchInterval: 5000,
  });
}

export function useChannelMembers(channelId: string | undefined | null) {
  return useQuery({
    queryKey: channelKeys.members(channelId!),
    queryFn: () =>
      api.get<ChannelMemberLite[]>(`/channels/${channelId}/members`).then((r) => r.data),
    enabled: Boolean(channelId),
  });
}

export function useSendMessage(projectId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { body: string; mentions?: { kind: "user" | "here" | "channel"; userId?: string }[]; references?: { type: string; id: string; label: string }[] }) =>
      api.post<ChatMessage>(`/channels/${channelId}/messages`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.all(channelId) });
      queryClient.invalidateQueries({ queryKey: channelKeys.project(projectId) });
    },
  });
}

export function useReferenceSearch(query: string) {
  return useQuery({
    queryKey: ["references", "search", query],
    queryFn: () =>
      api.get<{ type: string; id: string; label: string; projectId: string }[]>('/references/search', { params: { q: query } }).then((r) => r.data),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
  });
}

export function useEditMessage(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, body }: { messageId: string; body: string }) =>
      api.patch<ChatMessage>(`/messages/${messageId}`, { body }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.all(channelId) });
    },
  });
}

export function useDeleteMessage(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) =>
      api.delete<ChatMessage>(`/messages/${messageId}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.all(channelId) });
    },
  });
}

export function useMarkChannelRead(projectId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lastReadMessageId: string) =>
      api.patch(`/channels/${channelId}/members/me`, { lastReadMessageId }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.project(projectId) });
    },
  });
}
