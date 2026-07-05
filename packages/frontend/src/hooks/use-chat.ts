import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { channelKeys, messageKeys } from "./query-keys";
import { chatApi } from "@/api/chat";
import type { SendMessageInput, UpdateMembershipInput, CreateChannelInput } from "@/api/chat";

const MESSAGE_PAGE_SIZE = 50;

export function useProjectChannels(projectId: string | undefined | null) {
  return useQuery({
    queryKey: channelKeys.project(projectId!),
    queryFn: () => chatApi.getProjectChannels(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useChannelMessages(channelId: string | undefined | null) {
  return useInfiniteQuery({
    queryKey: messageKeys.list(channelId!),
    queryFn: ({ pageParam }) =>
      chatApi.getChannelMessages(channelId!, { before: pageParam, limit: MESSAGE_PAGE_SIZE }),
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
    queryFn: () => chatApi.getChannelMembers(channelId!),
    enabled: Boolean(channelId),
  });
}

export function useSendMessage(projectId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SendMessageInput) => chatApi.sendMessage(channelId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.all(channelId) });
      queryClient.invalidateQueries({ queryKey: channelKeys.project(projectId) });
    },
  });
}

export function useReferenceSearch(query: string) {
  return useQuery({
    queryKey: ["references", "search", query],
    queryFn: () => chatApi.searchReferences(query),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
  });
}

export function useLinkPreview(url: string | null) {
  return useQuery({
    queryKey: ["link-preview", url],
    queryFn: () => chatApi.getLinkPreview(url!),
    enabled: Boolean(url),
    staleTime: 1000 * 60 * 60,
    retry: false,
  });
}

export function useForwardToActionItem() {
  return useMutation({
    mutationFn: (messageId: string) => chatApi.forwardToActionItem(messageId),
  });
}

export function useMessageSearch(query: string, channelId?: string) {
  return useQuery({
    queryKey: ["messages", "search", query, channelId ?? "all"],
    queryFn: () => chatApi.searchMessages(query, channelId),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 30,
  });
}

export function useEditMessage(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, body }: { messageId: string; body: string }) =>
      chatApi.editMessage(messageId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.all(channelId) });
    },
  });
}

export function useDeleteMessage(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => chatApi.deleteMessage(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.all(channelId) });
    },
  });
}

export function useMarkChannelRead(projectId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lastReadMessageId: string) => chatApi.markChannelRead(channelId, lastReadMessageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.project(projectId) });
    },
  });
}

export function useToggleReaction(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      chatApi.toggleReaction(messageId, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.all(channelId) });
    },
  });
}

export function usePins(channelId: string | undefined | null) {
  return useQuery({
    queryKey: ["channels", channelId, "pins"],
    queryFn: () => chatApi.getPins(channelId!),
    enabled: Boolean(channelId),
  });
}

export function usePinMessage(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => chatApi.pinMessage(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", channelId, "pins"] });
    },
  });
}

export function useUnpinMessage(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => chatApi.unpinMessage(channelId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", channelId, "pins"] });
    },
  });
}

export function useThread(rootId: string | undefined | null) {
  return useQuery({
    queryKey: ["messages", rootId, "thread"],
    queryFn: () => chatApi.getThread(rootId!),
    enabled: Boolean(rootId),
  });
}

export function useOpenDm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId }: { userId: string }) => chatApi.openDm(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.all });
    },
  });
}

export function useAllChannels() {
  return useQuery({
    queryKey: channelKeys.list(),
    queryFn: () => chatApi.getAllChannels(),
  });
}

export function useUpdateMembership(channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateMembershipInput) => chatApi.updateMembership(channelId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.all });
    },
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChannelInput) => chatApi.createChannel(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.all });
    },
  });
}
