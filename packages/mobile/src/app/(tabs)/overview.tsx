import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Card, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { UpdateCard } from "@/components/molecules/update-card";
import { StaleBanner } from "@/components/molecules/stale-banner";
import { ICON_BRAND } from "@/constants/colors";
import { useProject } from "@/hooks/use-projects";
import { useActivities } from "@/hooks/use-activities";
import { useKeyDates } from "@/hooks/use-key-dates";
import { useProjectUpdates } from "@/hooks/use-updates";
import { useFieldSession } from "@/lib/field-session";
import { useStageScope } from "@/lib/stage-scope";
import { matchesStage } from "@/lib/stage-filter";

function SectionTitle({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <View className="flex-row items-center justify-between pb-2 pt-5">
      <Text variant="heading" weight="semibold" className="text-lg">{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`View all ${title.toLowerCase()}`} onPress={onPress} className="min-h-11 justify-center px-2">
        <Text tone="brand" weight="medium" className="text-sm">View all</Text>
      </Pressable>
    </View>
  );
}

export default function Overview() {
  const { projectId } = useFieldSession();
  const project = useProject(projectId);
  // Overview remains useful when the optional buildings feature is disabled.
  const activities = useActivities(projectId, true, null);
  const dates = useKeyDates(projectId, true, null);
  const updates = useProjectUpdates(projectId);
  const scope = useStageScope();
  const progress = scope.stageId ? scope.stage?.progressPercent : project.data?.progressPercent;
  const percent = typeof progress === "number" && Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : undefined;
  const visibleActivities = activities.data?.filter((activity) => matchesStage(activity.phaseId, scope.stageId));
  const upcoming = (dates.data ?? []).filter((date) => !date.actualDate && date.targetDate &&
    matchesStage(date.linkedActivityId ? scope.activityStages.get(date.linkedActivityId) : undefined, scope.stageId))
    .sort((a, b) => a.targetDate!.localeCompare(b.targetDate!)).slice(0, 3);
  const delayed = visibleActivities?.filter((activity) => activity.isDelayed).length;

  return (
    <Page stageScope title="Overview" projectName={project.data?.name}
      projectPending={project.isPending} onPressProject={() => router.push("/select-project")}>
      {project.isStale || activities.isStale || dates.isStale || updates.isStale ? <StaleBanner what="project overview" /> : null}
      <Card className="p-5">
        <View className="flex-row items-center justify-between gap-3">
          <Text tone="secondary" className="text-sm">{scope.stageId ? "Stage progress" : "Project progress"}</Text>
          <Ionicons name="trending-up-outline" size={20} color={ICON_BRAND} />
        </View>
        <Text variant="heading" weight="bold" className="pt-2 text-4xl">{percent === undefined ? "—" : `${Math.round(percent)}%`}</Text>
        <Text className="pt-1 text-sm" numberOfLines={2}>{scope.stage?.name ?? project.data?.name ?? "Loading project…"}</Text>
        <View className="mt-4 h-2 overflow-hidden rounded-full bg-surface-alt"
          accessibilityRole="progressbar" accessibilityLabel={scope.stageId ? "Stage progress" : "Project progress"}
          accessibilityValue={percent === undefined ? undefined : { min: 0, max: 100, now: percent }}>
          <View className="h-2 rounded-full bg-primary-500" style={{ width: `${percent ?? 0}%` }} />
        </View>
        {project.error && !project.data ? <Text tone="danger" className="pt-2 text-sm">Project details are unavailable.</Text> : null}
      </Card>
      <View className="mt-3 flex-row gap-3">
        <Pressable accessibilityRole="button" onPress={() => router.push("/tools/schedule/activities")} className="flex-1">
          <Card className="p-4">
            <Text tone="secondary" className="text-xs">Activities</Text>
            <Text variant="heading" weight="bold" className="pt-2 text-2xl">{visibleActivities?.length ?? "—"}</Text>
          </Card>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push("/(tabs)/schedule")} className="flex-1">
          <Card className="p-4">
            <Text tone="secondary" className="text-xs">Delayed activities</Text>
            <Text variant="heading" weight="bold" tone={delayed ? "danger" : "default"} className="pt-2 text-2xl">{delayed ?? "—"}</Text>
          </Card>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push("/(tabs)/schedule")} className="mt-3 min-h-14 flex-row items-center gap-3 rounded-xl border border-line bg-surface px-4">
        <Ionicons name="calendar-outline" size={20} color={ICON_BRAND} />
        <Text weight="medium" className="flex-1 text-sm">Schedule and build stages</Text>
        <Ionicons name="arrow-forward" size={18} color={ICON_BRAND} />
      </Pressable>
      <SectionTitle title="Key dates" onPress={() => router.push("/tools/schedule/key-dates")} />
      <Card>
        {dates.isPending ? <View className="p-5"><Spinner /></View> : upcoming.length ? upcoming.map((date) => (
          <Pressable key={date.id} accessibilityRole="button" onPress={() => router.push(`/tools/schedule/key-dates/${date.id}` as never)} className="min-h-16 flex-row items-center gap-3 border-b border-line px-4 py-3">
            <Ionicons name="flag-outline" size={18} color={ICON_BRAND} />
            <Text weight="medium" className="flex-1 text-sm">{date.label}</Text>
            <Text tone="secondary" className="text-xs">{new Date(`${date.targetDate!.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</Text>
          </Pressable>
        )) : <Text tone="secondary" className="p-4 text-sm">{dates.error ? "Key dates are unavailable. Open the schedule to retry." : "No upcoming key dates in this view."}</Text>}
      </Card>
      <SectionTitle title="Recent updates" onPress={() => router.push("/tools/updates")} />
      {updates.isPending ? <Spinner /> : updates.data?.length ? (
        <View className="gap-3">{updates.data.slice(0, 3).map((update) => <UpdateCard key={update.id} update={update} onPress={() => router.push(`/tools/updates/${update.id}` as never)} />)}</View>
      ) : <Card className="p-4"><Text tone="secondary" className="text-sm">{updates.error ? "Updates are unavailable. Try again when connected." : "No updates in this view yet."}</Text></Card>}
    </Page>
  );
}
