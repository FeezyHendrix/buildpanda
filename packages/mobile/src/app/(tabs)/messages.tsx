import { router } from "expo-router";
import { useCallback } from "react";
import { FlatList, View, type ListRenderItemInfo } from "react-native";
import type { Channel } from "@/api/messaging";
import { Button, Spinner, Text } from "@/components/atoms";
import { ChannelRow } from "@/components/messaging/channel-row";
import { Page } from "@/components/molecules/page";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { useMessagingChannels } from "@/hooks/use-messaging";
import { useProject } from "@/hooks/use-projects";
import { useFieldSession } from "@/lib/field-session";
import { useSyncState } from "@/lib/sync-provider";

const channelKey = (channel: Channel) => channel.id;

export default function Messages() {
  const { projectId, storageOwnerId } = useFieldSession();
  const { isOnline } = useSyncState();
  const project = useProject(projectId);
  const inbox = useMessagingChannels();
  const renderChannel = useCallback(({ item }: ListRenderItemInfo<Channel>) => <ChannelRow channel={item} ownerId={storageOwnerId} />, [storageOwnerId]);
  return (
    <Page title="Messages" projectName={project.data?.name} projectPending={project.isPending}
      onPressProject={() => router.push("/select-project")} scroll={false}
      rightButtons={<HeaderIconButton icon="create-outline" label="New direct message" onPress={() => router.push("/messages/new")} />}>
      <Text tone="secondary" className="pb-4 text-sm">Project channels and direct messages</Text>
      {!isOnline ? <Text tone="secondary" className="pb-3 text-xs">Offline · Showing saved conversations</Text> : null}
      {inbox.error || inbox.accessDenied ? <View className="gap-2 pb-3"><Text tone="danger" className="text-sm">{inbox.accessDenied ? "Some conversations are no longer available to this account." : "Couldn’t refresh conversations. Your saved messages are available."}</Text><Button variant="secondary" onPress={() => { void inbox.refetch(); }}>Try again</Button></View> : null}
      <FlatList data={inbox.channels} keyExtractor={channelKey} renderItem={renderChannel}
        keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}
        refreshing={false} onRefresh={() => { void inbox.refetch(); }}
        ListEmptyComponent={inbox.isPending ? <View className="py-12"><Spinner /></View> : <View className="items-center gap-2 px-6 py-12"><Text variant="heading" weight="semibold" className="text-lg">No conversations yet</Text><Text tone="secondary" className="text-center text-sm">{!isOnline ? "Connect to load your conversations." : "Open a project conversation or start a direct message with your team."}</Text></View>} />
    </Page>
  );
}
