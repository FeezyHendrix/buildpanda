import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { channelKeys, messageKeys } from "./query-keys";
import type { Channel, ChatMessage, ChannelMemberLite } from "@/lib/project-types";

const MESSAGE_PAGE_SIZE = 50;

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
        params: { before: pageParam, limit: MESSAGE_PAGE_SIZE },
      }).then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: () => undefined,
    getPreviousPageParam: (firstPage) => firstPage.length === MESSAGE_PAGE_SIZE ? firstPage[0]!.id : undefined,
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
    mutationFn: (data: { body: string; parentMessageId?: string; quotedMessageId?: string; mentions?: { kind: "user" | "here" | "channel"; userId?: string }[]; references?: { type: string; id: string; label: string }[]; attachments?: { fileId: string; url: string; name: string; mime?: string; size?: number }[] }) =>
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

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

export function useLinkPreview(url: string | null) {
  return useQuery({
    queryKey: ["link-preview", url],
    queryFn: () =>
      api.post<{ preview: LinkPreview | null }>("/link-preview", { url }).then((r) => r.data.preview),
    enabled: Boolean(url),
    staleTime: 1000 * 60 * 60,
    retry: false,
  });
}

export function useForwardToActionItem() {
  return useMutation({
    mutationFn: (messageId: string) =>
      api.post<{ id: string }>(`/messages/${messageId}/forward-to-action-item`).then((r) => r.data),
  });
}

export function useMessageSearch(query: string, channelId?: string) {
  return useQuery({
    queryKey: ["messages", "search", query, channelId ?? "all"],
    queryFn: () =>
      api
        .get<ChatMessage[]>("/search/messages", { params: { q: query, channelId } })
        .then((r) => r.data),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 30,
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

export function useToggleReaction(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      api.post(`/messages/${messageId}/reactions`, { emoji }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.all(channelId) });
    },
  });
}

export function usePins(channelId: string | undefined | null) {
  return useQuery({
    queryKey: ["channels", channelId, "pins"],
    queryFn: () =>
      api.get<ChatMessage[]>(`/channels/${channelId}/pins`).then((r) => r.data),
    enabled: Boolean(channelId),
  });
}

export function usePinMessage(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) =>
      api.post(`/messages/${messageId}/pin`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", channelId, "pins"] });
    },
  });
}

export function useUnpinMessage(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) =>
      api.delete(`/channels/${channelId}/pins/${messageId}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", channelId, "pins"] });
    },
  });
}

export function useThread(rootId: string | undefined | null) {
  return useQuery({
    queryKey: ["messages", rootId, "thread"],
    queryFn: () =>
      api.get<ChatMessage[]>(`/messages/${rootId}/thread`).then((r) => r.data),
    enabled: Boolean(rootId),
  });
}

export function useOpenDm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      api.post<Channel>('/channels/dm', { userId }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.all });
    },
  });
}

export function useAllChannels() {
  return useQuery({
    queryKey: channelKeys.list(),
    queryFn: () => api.get<Channel[]>('/channels').then((r) => r.data),
  });
}

export function useUpdateMembership(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { muted?: boolean; notifyLevel?: "all" | "mentions" | "none" }) =>
      api.patch(`/channels/${channelId}/members/me`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.all });
    },
  });
}

export interface CreateChannelInput {
  type: "project" | "org";
  name: string;
  projectId?: string | null;
  isPrivate?: boolean;
  topic?: string | null;
}

export function useCreateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChannelInput) =>
      api.post<Channel>("/channels", input).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.all });
    },
  });
}
