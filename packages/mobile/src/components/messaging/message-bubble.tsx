import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { memo, useState } from "react";
import { Linking, Platform, Pressable, View } from "react-native";
import type { Message } from "@/api/messaging";
import { Spinner, Text } from "@/components/atoms";
import { ICON_BRAND } from "@/constants/colors";
import { API_BASE_URL } from "@/lib/auth-client";
import { cacheFileById } from "@/lib/download-file";
import { cn } from "@/lib/utils";

const timeFormatter = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function Attachment({ file }: { file: Message["attachments"][number] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function open() {
    setBusy(true);
    setError("");
    try {
      if (Platform.OS === "web") {
        await Linking.openURL(`${API_BASE_URL}/files/${encodeURIComponent(file.fileId)}/download`);
      } else {
        const uri = await cacheFileById(file.fileId, file.name);
        router.push({ pathname: "/tools/documents/view", params: { uri, name: file.name } });
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t open this attachment."); }
    finally { setBusy(false); }
  }
  return <View><Pressable accessibilityRole="button" accessibilityLabel={`Open attachment ${file.name}`} disabled={busy} onPress={() => { void open(); }} className="mt-2 min-h-11 flex-row items-center gap-2 rounded-lg border border-primary-100 bg-surface px-3 py-2">
    {busy ? <Spinner size="xs" /> : <Ionicons name="attach-outline" size={18} color={ICON_BRAND} />}<Text tone="brand" className="shrink text-sm">{file.name}</Text>
  </Pressable>{error ? <Text tone="danger" className="pt-1 text-xs">{error}</Text> : null}</View>;
}

export const MessageBubble = memo(function MessageBubble({ message, ownerId, onReply }: {
  message: Message; ownerId: string | undefined; onReply?: (message: Message) => void;
}) {
  const mine = message.authorId === ownerId;
  return (
    <View className={cn("mb-4 max-w-[92%]", mine ? "self-end" : "self-start")}>
      <Text tone="secondary" weight="medium" className={cn("pb-1 text-xs", mine && "text-right")}>{mine ? "You" : message.authorName || "Teammate"}</Text>
      <View className={cn("rounded-2xl border px-4 py-3", mine ? "rounded-br-sm border-primary-100 bg-primary-50" : "rounded-bl-sm border-line bg-surface")}>
        {message.deletedAt ? <Text tone="secondary" className="text-sm italic">Message deleted</Text> : <>
          {message.quotedMessage ? <View className="mb-2 border-l-2 border-primary-500 pl-3"><Text weight="semibold" className="text-xs">{message.quotedMessage.authorName || "Teammate"}</Text><Text tone="secondary" numberOfLines={3} className="pt-1 text-xs">{message.quotedMessage.deleted ? "Message deleted" : message.quotedMessage.body}</Text></View> : null}
          {message.body ? <Text selectable className="text-base leading-6">{message.body}</Text> : null}
          {(message.attachments ?? []).map((file) => <Attachment key={file.fileId} file={file} />)}
          {message.resolvedReferences?.map((reference) => <Text key={`${reference.type}:${reference.id}`} tone="secondary" className="pt-2 text-xs">{reference.restricted ? "Restricted project record" : reference.title || "Project record"}</Text>)}
          {message.reactions?.length ? <View className="mt-2 flex-row flex-wrap gap-2">{message.reactions.map((reaction) => <View key={reaction.emoji} className="rounded-full border border-line bg-surface px-2 py-1"><Text className="text-xs">{reaction.emoji} {reaction.count}</Text></View>)}</View> : null}
        </>}
        <Text tone="secondary" className="pt-2 text-[10px]">{timeFormatter.format(new Date(message.createdAt))}{message.editedAt ? " · Edited" : ""}{mine && message.readAt ? " · Read" : ""}</Text>
      </View>
      {onReply ? <Pressable accessibilityRole="button" accessibilityLabel={`Reply to ${message.authorName || "message"}`} onPress={() => onReply(message)} className="min-h-11 justify-center self-start px-2"><Text tone="brand" weight="medium" className="text-xs">{message.replyCount ? `${message.replyCount} ${message.replyCount === 1 ? "reply" : "replies"}` : "Reply"}</Text></Pressable> : null}
    </View>
  );
});
