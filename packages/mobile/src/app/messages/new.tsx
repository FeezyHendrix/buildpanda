import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Button, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { SearchField } from "@/components/molecules/search-field";
import { useChannelMembers, useMessagingActions, useMessagingChannels } from "@/hooks/use-messaging";
import { useFieldSession } from "@/lib/field-session";
import { goBack } from "@/lib/navigation";
import { useSyncState } from "@/lib/sync-provider";

export default function NewMessage() {
  const { storageOwnerId, projectId } = useFieldSession();
  const { isOnline } = useSyncState();
  const inbox = useMessagingChannels();
  const general = inbox.channels.find((channel) => channel.projectId === projectId && channel.name === "general");
  const members = useChannelMembers(general?.id ?? "");
  const { openDm } = useMessagingActions();
  const [query, setQuery] = useState("");
  const people = useMemo(() => (members.data ?? []).filter((member) => member.id !== storageOwnerId &&
    `${member.name ?? ""} ${member.email}`.toLowerCase().includes(query.trim().toLowerCase())), [members.data, storageOwnerId, query]);
  return (
    <Page title="New message" description="Choose someone from this project." onBack={goBack} scroll={false}>
      <View className="pb-3"><SearchField value={query} onChange={setQuery} placeholder="Search teammates" /></View>
      {!isOnline ? <Text tone="secondary" className="pb-3 text-sm">Reconnect to start a conversation.</Text> : null}
      {openDm.error ? <Text accessibilityRole="alert" tone="danger" className="pb-3 text-sm">{openDm.error.message}</Text> : null}
      {members.error || inbox.error ? <Button variant="secondary" onPress={() => { void inbox.refetch(); void members.refetch(); }}>Retry loading teammates</Button> : null}
      <FlatList data={people} keyExtractor={(person) => person.id} keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Message ${item.name || item.email}`}
          disabled={!isOnline || openDm.isPending} className="min-h-20 flex-row items-center gap-3 border-b border-line bg-surface px-4 py-3 active:bg-surface-alt"
          onPress={() => openDm.mutate(item.id, { onSuccess: (channel) => router.replace({ pathname: "/messages/[id]", params: { id: channel.id } }) })}>
          <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-50"><Text tone="brand" weight="bold">{(item.name || item.email).slice(0, 2).toUpperCase()}</Text></View>
          <View className="min-w-0 flex-1"><Text weight="semibold" className="text-base">{item.name || item.email}</Text><Text tone="secondary" className="pt-1 text-xs" numberOfLines={1}>{item.email}</Text></View>
          {openDm.isPending && openDm.variables === item.id ? <Spinner /> : null}
        </Pressable>}
        ListEmptyComponent={inbox.isPending || (general && members.isPending) ? <View className="py-12"><Spinner /></View> : <Text tone="secondary" className="py-12 text-center">{members.accessDenied || inbox.accessDenied ? "Your account cannot view this project’s teammates." : query ? "No teammates match your search." : "No teammates available in this project yet."}</Text>} />
    </Page>
  );
}
