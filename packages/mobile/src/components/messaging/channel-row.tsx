import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { memo } from "react";
import { Pressable, View } from "react-native";
import type { Channel } from "@/api/messaging";
import { Text } from "@/components/atoms";
import { ICON_BRAND, ICON_MUTED } from "@/constants/colors";
import { useChannelMembers } from "@/hooks/use-messaging";
import { conversationName } from "@/lib/messaging";

export const ChannelRow = memo(function ChannelRow({ channel, ownerId }: { channel: Channel; ownerId: string | undefined }) {
  const direct = channel.type === "dm" || channel.type === "group_dm";
  const members = useChannelMembers(channel.id, direct);
  const name = conversationName(channel, members.data ?? [], ownerId);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name}${channel.unreadCount ? `, ${channel.unreadCount} unread` : ""}`}
      onPress={() => router.push({ pathname: "/messages/[id]", params: { id: channel.id } })}
      className="min-h-20 flex-row items-center gap-3 border-b border-line bg-surface px-4 py-4 active:bg-surface-alt">
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary-50">
        {direct ? <Text tone="brand" weight="bold">{name.slice(0, 2).toUpperCase()}</Text> : <Ionicons name={channel.isPrivate ? "lock-closed-outline" : "chatbubbles-outline"} size={22} color={ICON_BRAND} />}
      </View>
      <View className="min-w-0 flex-1">
        <Text weight={channel.unreadCount ? "bold" : "semibold"} numberOfLines={1} className="text-base">{name}</Text>
        <Text tone="secondary" numberOfLines={1} className="pt-1 text-xs">{channel.topic || (direct ? "Direct message" : channel.type === "org" ? "Workspace conversation" : "Project conversation")}</Text>
      </View>
      {channel.muted ? <Ionicons name="notifications-off-outline" size={16} color={ICON_MUTED} /> : null}
      {channel.unreadCount > 0 ? <View className="min-w-6 items-center rounded-full bg-primary-500 px-2 py-1"><Text tone="inverse" weight="bold" className="text-xs">{channel.unreadCount > 99 ? "99+" : channel.unreadCount}</Text></View> : <Ionicons name="chevron-forward" size={18} color={ICON_MUTED} />}
    </Pressable>
  );
});
