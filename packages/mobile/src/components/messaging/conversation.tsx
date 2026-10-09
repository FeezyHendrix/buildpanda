import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, FlatList, Pressable, TextInput, View, type ListRenderItemInfo } from "react-native";
import type { Message } from "@/api/messaging";
import { messagingApi } from "@/api/messaging";
import { Button, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { ICON_INVERSE, ICON_MUTED } from "@/constants/colors";
import { useChannelMembers, useChannelMessages, useMessageThread, useMessagingActions, useMessagingChannel, useThreadRoot } from "@/hooks/use-messaging";
import { useFieldSession } from "@/lib/field-session";
import { conversationName, isSendableMessage, mergeMessages, messageDraftKey, MESSAGE_LIMIT, MESSAGE_PAGE_SIZE } from "@/lib/messaging";
import { goBack } from "@/lib/navigation";
import { queryStorage } from "@/lib/query-storage";
import { useSyncState } from "@/lib/sync-provider";
import { MessageBubble } from "./message-bubble";

const messageKey = (message: Message) => message.id;
const EMPTY_MESSAGES: Message[] = [];

function useActiveConversation() {
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== "background");
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => subscription.remove();
  }, []);
  return focused && foreground;
}

export function Conversation({ channelId, threadId }: { channelId: string; threadId?: string }) {
  const { storageOwnerId, organizationId } = useFieldSession();
  const { isOnline } = useSyncState();
  const active = useActiveConversation();
  const channel = useMessagingChannel(channelId, active);
  const members = useChannelMembers(channelId, active);
  const timeline = useChannelMessages(channelId, active && !threadId);
  const thread = useMessageThread(threadId, active);
  const root = useThreadRoot(threadId, active);
  const query = threadId ? thread : timeline;
  const { send, markRead } = useMessagingActions(channelId);
  const draftKey = messageDraftKey(storageOwnerId, organizationId, channelId, threadId);
  const [body, setBody] = useState(() => { try { return queryStorage.getItem(draftKey) ?? ""; } catch { return ""; } });
  const [draftError, setDraftError] = useState("");
  const [history, setHistory] = useState<Message[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [exhausted, setExhausted] = useState(false);
  const [atLatest, setAtLatest] = useState(true);
  const lastRead = useRef<string | undefined>(undefined);
  const sendLock = useRef(false);
  const scrollAfterSend = useRef(false);
  const list = useRef<FlatList<Message>>(null);
  const denied = channel.accessDenied || query.accessDenied || Boolean(threadId && (root.accessDenied || (root.data && root.data.channelId !== channelId)));
  const newest = query.data ?? EMPTY_MESSAGES;
  const messages = useMemo(() => mergeMessages(history, newest), [history, newest]);
  const reversed = useMemo(() => [...messages].reverse(), [messages]);
  const latestId = messages.at(-1)?.id;
  const name = conversationName(channel.data, members.data ?? [], storageOwnerId);

  useEffect(() => {
    if (denied) setHistory([]);
    else if (query.data) setHistory((previous) => mergeMessages(previous, query.data!));
  }, [query.data, denied]);

  const readMessage = markRead.mutate;
  useEffect(() => {
    if (!active || !isOnline || !atLatest || denied || !latestId || latestId === lastRead.current) return;
    lastRead.current = latestId;
    readMessage(latestId, { onError: () => { lastRead.current = undefined; } });
  }, [active, isOnline, atLatest, denied, latestId, query.dataUpdatedAt, readMessage]);

  function changeBody(value: string) {
    setBody(value);
    try { queryStorage.setItem(draftKey, value); setDraftError(""); }
    catch { setDraftError("Your draft could not be saved on this device. Keep this conversation open until it sends."); }
  }

  async function submit() {
    if (sendLock.current || !isOnline || !isSendableMessage(body) || denied || channel.data?.archivedAt) return;
    sendLock.current = true;
    try {
      const message = await send.mutateAsync({ body: body.trim(), threadId });
      scrollAfterSend.current = true;
      setHistory((previous) => mergeMessages(previous, [message]));
      changeBody("");
    } catch { /* The composer keeps its draft and displays the mutation error. */ }
    finally { sendLock.current = false; }
  }

  async function loadOlder() {
    const before = messages[0]?.id;
    if (!before || loadingOlder || !isOnline) return;
    setLoadingOlder(true);
    setHistoryError("");
    try {
      const page = await messagingApi.messages(channelId, before);
      setHistory((previous) => mergeMessages(page, previous));
      setExhausted(page.length < MESSAGE_PAGE_SIZE);
    } catch { setHistoryError("Couldn’t load older messages. Try again."); }
    finally { setLoadingOlder(false); }
  }

  const openThread = useCallback((message: Message) => {
    router.push({ pathname: "/messages/[id]", params: { id: channelId, thread: message.id } });
  }, [channelId]);
  const renderMessage = useCallback(({ item }: ListRenderItemInfo<Message>) => <MessageBubble message={item} ownerId={storageOwnerId} onReply={threadId ? undefined : openThread} />, [storageOwnerId, threadId, openThread]);
  const canCompose = Boolean(channel.data && !denied && !channel.data.archivedAt && (!threadId || (root.data && root.data.channelId === channelId)));

  return (
    <Page title={threadId ? "Thread" : name} description={threadId ? name : channel.data?.topic || undefined} onBack={goBack} scroll={false} showSync={false}
      footer={canCompose ? <View className="gap-2 border-t border-line bg-canvas pt-2">
        {!isOnline ? <Text tone="secondary" className="text-xs">Offline · Draft saved here. Reconnect to send.</Text> : null}
        {send.error ? <Text accessibilityRole="alert" tone="danger" className="text-sm">Message not confirmed. Your draft is saved. Check the conversation before trying again.</Text> : null}
        {draftError ? <Text accessibilityRole="alert" tone="danger" className="text-xs">{draftError}</Text> : null}
        <View className="flex-row items-end gap-2">
          <TextInput accessibilityLabel={threadId ? "Write a reply" : "Write a message"} placeholder={threadId ? "Write a reply…" : "Write a message…"}
            placeholderTextColor={ICON_MUTED} multiline maxLength={MESSAGE_LIMIT} editable={!send.isPending} value={body} onChangeText={changeBody}
            className="max-h-36 min-h-12 flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink"
            style={{ fontFamily: "Inter_400Regular", textAlignVertical: "top" }} />
          <Pressable accessibilityRole="button" accessibilityLabel={threadId ? "Send reply" : "Send message"}
            accessibilityState={{ disabled: !isOnline || !isSendableMessage(body) || send.isPending, busy: send.isPending }}
            disabled={!isOnline || !isSendableMessage(body) || send.isPending} onPress={() => { void submit(); }}
            className="h-12 w-12 items-center justify-center rounded-xl bg-primary-500 disabled:opacity-40">
            {send.isPending ? <Spinner tone="current" /> : <Ionicons name="arrow-up" size={24} color={ICON_INVERSE} />}
          </Pressable>
        </View>
      </View> : undefined}>
      {denied ? <View className="gap-4 py-12"><Text variant="heading" weight="semibold" className="text-lg">Conversation unavailable</Text><Text tone="secondary">This conversation is no longer available to your account.</Text><Button onPress={() => router.replace("/(tabs)/messages")}>Back to messages</Button></View> : <>
        {channel.data?.archivedAt ? <Text tone="secondary" className="pb-3 text-sm">Archived conversation · Read only</Text> : null}
        {query.error || channel.error || root.error ? <View className="gap-2 pb-3"><Text tone="secondary" className="text-xs">Couldn’t refresh this conversation. Showing saved messages.</Text><Button variant="secondary" onPress={() => { void query.refetch(); void channel.refetch(); if (threadId) void root.refetch(); }}>Try again</Button></View> : null}
        <FlatList ref={list} data={reversed} inverted keyExtractor={messageKey} renderItem={renderMessage}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingVertical: 12 }}
          maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 60 }}
          onContentSizeChange={() => {
            // Wait for the new row's layout; scrolling before React commits leaves it below the viewport on iOS.
            if (scrollAfterSend.current) {
              scrollAfterSend.current = false;
              list.current?.scrollToOffset({ offset: 0, animated: false });
            }
          }}
          onScroll={(event) => setAtLatest(event.nativeEvent.contentOffset.y < 60)} scrollEventThrottle={100}
          ListEmptyComponent={<View style={{ transform: [{ scaleY: -1 }] }} className="items-center gap-3 py-10">{query.isPending || channel.isPending ? <Spinner /> : <><Text variant="heading" weight="semibold" className="text-lg">{threadId ? "No replies yet" : "Start the conversation"}</Text><Text tone="secondary" className="text-center text-sm">{!isOnline ? "Connect to load messages. Your saved draft will stay here." : "Share an update with your team."}</Text></>}</View>}
          ListFooterComponent={<View>
            {threadId && root.data ? <MessageBubble message={root.data} ownerId={storageOwnerId} /> : null}
            {!threadId && !exhausted && newest.length === MESSAGE_PAGE_SIZE ? <View className="pb-4"><Button variant="secondary" loading={loadingOlder} disabled={!isOnline} onPress={() => { void loadOlder(); }}>Load older messages</Button></View> : null}
            {historyError ? <Text tone="danger" className="pb-4 text-sm">{historyError}</Text> : null}
          </View>} />
        {!atLatest ? <Button variant="secondary" onPress={() => list.current?.scrollToOffset({ offset: 0, animated: true })}>Latest messages</Button> : null}
      </>}
    </Page>
  );
}
