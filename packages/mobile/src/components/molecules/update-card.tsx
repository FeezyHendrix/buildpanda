import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, View } from "react-native";
import type { ProjectUpdate } from "@/api/updates";
import { Card, Text } from "@/components/atoms";
import { ICON_AMBER } from "@/constants/colors";
import { formatDate } from "@/lib/dates";

/**
 * One update in the feed. Shared by the Tools feed, the full list and the
 * detail view so a draft badge can never mean different things in two places.
 */
export function UpdateCard({
  update,
  onPress,
  expanded = false,
}: {
  update: ProjectUpdate;
  onPress?: () => void;
  expanded?: boolean;
}) {
  const isPandaDraft = update.isDraft && update.generatedKind !== null;

  const body = (
    <Card className="gap-2 p-4">
      <View className="flex-row flex-wrap items-center gap-2">
        <View className="rounded-full bg-primary-50 px-2.5 py-1">
          <Text weight="semibold" tone="brand" className="text-[10px] uppercase">
            {update.category}
          </Text>
        </View>
        {update.isDraft ? (
          <View className="flex-row items-center gap-1 rounded-full bg-warning-50 px-2.5 py-1">
            {isPandaDraft ? <Ionicons name="sparkles-outline" size={11} color={ICON_AMBER} /> : null}
            <Text weight="semibold" className="text-[10px] uppercase text-amber-700">
              {isPandaDraft ? "Panda AI draft" : "Draft"}
            </Text>
          </View>
        ) : null}
      </View>

      <Text weight="bold" className="text-[15px]">
        {update.title}
      </Text>
      <Text tone="secondary" className="text-[13px]" numberOfLines={expanded ? undefined : 4}>
        {update.description}
      </Text>

      <Text tone="muted" className="pt-1 text-[11px]">
        {update.author.name} · {formatDate(update.createdAt)}
      </Text>
    </Card>
  );

  if (!onPress) return body;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={update.title}>
      {body}
    </Pressable>
  );
}
