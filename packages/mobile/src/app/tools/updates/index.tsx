import { router } from "expo-router";
import { View } from "react-native";
import type { ProjectUpdate } from "@/api/updates";
import { Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { UpdateCard } from "@/components/molecules/update-card";
import { useProjectUpdates } from "@/hooks/use-updates";
import { useFieldSession } from "@/lib/field-session";

export default function ProjectUpdates() {
  const { projectId } = useFieldSession();
  const { data, isPending, isStale } = useProjectUpdates(projectId);
  const updates = data ?? [];

  return (
    <Page title="Updates" onBack={() => router.back()}>
      {isStale ? (
        <Text tone="muted" className="pb-2 text-xs">
          Showing your last synced updates — you&apos;re offline.
        </Text>
      ) : null}

      {isPending ? (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      ) : updates.length === 0 ? (
        <View className="items-center py-12">
          <Text weight="semibold" className="text-base">
            No updates yet
          </Text>
          <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
            Published project updates appear here. Panda AI also drafts a weekly one from the
            field data unless it&apos;s turned off in project settings.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {updates.map((update) => (
            <UpdateCard
              key={update.id}
              update={update}
              onPress={() => router.push(`/tools/updates/${update.id}` as never)}
            />
          ))}
        </View>
      )}
    </Page>
  );
}
