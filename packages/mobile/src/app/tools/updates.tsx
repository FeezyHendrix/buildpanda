import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { View } from "react-native";
import type { ProjectUpdate } from "@/api/updates";
import { Card, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { useProjectUpdates } from "@/hooks/use-updates";
import { useFieldSession } from "@/lib/field-session";

function dateLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function UpdateCard({ update }: { update: ProjectUpdate }) {
  const isPandaDraft = update.isDraft && update.generatedKind !== null;
  return (
    <Card className="gap-2 p-4">
      <View className="flex-row flex-wrap items-center gap-2">
        <View className="rounded-full bg-primary-50 px-2.5 py-1">
          <Text weight="semibold" tone="brand" className="text-[10px] uppercase">
            {update.category}
          </Text>
        </View>
        {update.isDraft ? (
          <View className="flex-row items-center gap-1 rounded-full bg-warning-50 px-2.5 py-1">
            {isPandaDraft ? <Ionicons name="sparkles-outline" size={11} color="#8E6B00" /> : null}
            <Text weight="semibold" className="text-[10px] uppercase text-[#8E6B00]">
              {isPandaDraft ? "Panda AI draft" : "Draft"}
            </Text>
          </View>
        ) : null}
      </View>

      <Text weight="bold" className="text-[15px]">
        {update.title}
      </Text>
      <Text tone="secondary" className="text-[13px]" numberOfLines={4}>
        {update.description}
      </Text>

      <Text tone="muted" className="pt-1 text-[11px]">
        {update.author.name} · {dateLabel(update.createdAt)}
      </Text>
    </Card>
  );
}

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
            <UpdateCard key={update.id} update={update} />
          ))}
        </View>
      )}
    </Page>
  );
}
