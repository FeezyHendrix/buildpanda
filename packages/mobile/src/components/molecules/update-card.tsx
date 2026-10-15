import { RichContent } from "@/components/rich-text/rich-content";
import { Pressable, View } from "react-native";
import { Card, PendingBadge, Text } from "@/components/atoms";
import { MediaGallery } from "./media-gallery";
import type { LocalProjectUpdate } from "@/db/updates-repository";
import { formatDateTime } from "@/lib/dates";

/** Shared feed post: author, narrative, full media and the discussion action. */
export function UpdateCard({ update, onPress, expanded = false }: {
  update: LocalProjectUpdate;
  onPress?: () => void;
  expanded?: boolean;
}) {
  const initials = update.author.name.trim().split(/\s+/).slice(0, 2).map((name) => name[0] ?? "").join("").toUpperCase();
  return <Card className="gap-4 p-4">
    <View className="flex-row items-center gap-3">
      <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-50"><Text weight="bold" tone="brand">{initials || "BP"}</Text></View>
      <View className="flex-1 gap-1">
        <Text weight="semibold">{update.author.name || "Project team"}</Text>
        <Text tone="secondary" className="text-xs">{formatDateTime(update.createdAt)}</Text>
      </View>
      {update.isPendingSync ? <PendingBadge /> : null}
    </View>
    <View className="flex-row flex-wrap gap-2">
      <Text tone="brand" weight="semibold" className="rounded-full bg-primary-50 px-3 py-1 text-xs">{update.category}</Text>
      {update.isDraft ? <Text tone="secondary" className="text-xs">Draft</Text> : null}
    </View>
    {onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={update.title} className="min-h-11 justify-center">
      <Text weight="bold" className="text-base">{update.title}</Text>
    </Pressable> : <Text weight="bold" className="text-base">{update.title}</Text>}
    <RichContent html={update.descriptionHtml} text={update.description} />
    <MediaGallery media={update.media} />
    {!expanded && onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Comments on ${update.title}`}
      className="min-h-11 justify-center border-t border-hairline pt-2">
      <Text weight="semibold" tone="brand">Comments</Text>
    </Pressable> : null}
  </Card>;
}
