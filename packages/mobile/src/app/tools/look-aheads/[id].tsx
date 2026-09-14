import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Alert, View } from "react-native";
import type { Activity } from "@/api/activities";
import { Card, PendingBadge, Spinner, Text } from "@/components/atoms";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { Page } from "@/components/molecules/page";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useActivities } from "@/hooks/use-activities";
import { useDeleteLookAhead, useLocalLookAhead } from "@/hooks/use-local-look-aheads";
import { formatDate } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, { bg: string; text: string }> = {
  Draft: { bg: "bg-grey-50", text: "text-grey-500" },
  UnderReview: { bg: "bg-amber-50", text: "text-amber-700" },
  Approved: { bg: "bg-success-50", text: "text-success-700" },
};

/**
 * The assigned activities, named from the cached programme. The row only
 * stores ids, so an activity the cache has not seen yet is still listed —
 * by id — rather than silently dropped from a planning record.
 */
function AssignedActivities({ activityIds, activities }: { activityIds: string[]; activities: readonly Activity[] }) {
  const byId = useMemo(() => new Map(activities.map((activity) => [activity.id, activity])), [activities]);

  return (
    <View className="gap-3">
      <Text weight="bold" className="text-base">
        Activities in this window
      </Text>
      {activityIds.length === 0 ? (
        <View className="items-center py-8">
          <Text weight="semibold" className="text-center text-base">
            No activities assigned
          </Text>
          <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
            Edit this look ahead to pick the activities the crew will work on in this window.
          </Text>
        </View>
      ) : (
        <Card>
          {activityIds.map((activityId) => {
            const activity = byId.get(activityId);
            return (
              <View key={activityId} className="min-h-14 justify-center border-b border-hairline px-4 py-3">
                <Text weight="semibold" className="text-[15px]" numberOfLines={1}>
                  {activity?.name ?? "Activity not in the cached programme"}
                </Text>
                <Text tone="secondary" className="pt-0.5 text-xs" numberOfLines={1}>
                  {activity
                    ? [activity.phaseName, activity.location, activity.isDelayed ? "Delayed" : activity.status]
                        .filter(Boolean)
                        .join(" · ")
                    : activityId}
                </Text>
              </View>
            );
          })}
        </Card>
      )}
    </View>
  );
}

function LookAheadDetail({ db, projectId, lookAheadId }: { db: Db; projectId: string; lookAheadId: string }) {
  const { data: la } = useLocalLookAhead(db, lookAheadId);
  const activities = useActivities(projectId);

  if (!la) {
    return (
      <View className="items-center py-12">
        <Text tone="secondary" className="text-[13px]">This look ahead may not have synced yet.</Text>
      </View>
    );
  }

  const tone = STATUS_TONE[la.status] ?? STATUS_TONE.Draft;

  return (
    <View className="gap-5">
      <View className="flex-row flex-wrap items-center gap-2">
        <View className={cn("rounded-full px-2.5 py-1", tone.bg)}>
          <Text weight="semibold" className={cn("text-[11px] uppercase", tone.text)}>{la.status}</Text>
        </View>
        {la.isPendingSync ? <PendingBadge /> : null}
      </View>

      <Text weight="bold" className="text-lg">{la.name}</Text>

      {la.description ? (
        <Text tone="secondary" className="text-[14px] leading-5">{la.description}</Text>
      ) : null}

      <Card>
        <View className="flex-row border-b border-hairline">
          <View className="flex-1 border-r border-hairline px-4 py-3">
            <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">Start</Text>
            <Text className="pt-0.5 text-[15px]">{formatDate(la.startDate) || la.startDate}</Text>
          </View>
          <View className="flex-1 px-4 py-3">
            <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">End</Text>
            <Text className="pt-0.5 text-[15px]">{formatDate(la.endDate) || la.endDate}</Text>
          </View>
        </View>
        {la.totalWorkers ? (
          <View className="px-4 py-3">
            <Text weight="semibold" tone="muted" className="text-[10px] uppercase tracking-wide">Total crew</Text>
            <Text className="pt-0.5 text-[15px]">{la.totalWorkers} workers</Text>
          </View>
        ) : null}
      </Card>

      <AssignedActivities activityIds={la.activityIds} activities={activities.data ?? []} />
    </View>
  );
}

export default function LookAheadDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();
  const removeRecord = useDeleteLookAhead(db, projectId);

  // Native confirm: deleting a site record is destructive and the app has no
  // undo, so it must not happen on a single stray tap.
  function confirmDelete() {
    if (!id) return;
    Alert.alert("Delete this look ahead?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void removeRecord(id).then(() => router.back()).catch(() => undefined);
        },
      },
    ]);
  }

  return (
    <Page
      title="Look ahead"
      onBack={() => router.back()}
      rightButtons={
        id ? (
          <>
            <HeaderIconButton icon="create-outline" label="Edit look ahead" onPress={() => router.push(`/tools/look-aheads/edit/${id}` as never)} />
            <HeaderIconButton icon="trash-outline" label="Delete look ahead" onPress={confirmDelete} />
          </>
        ) : null
      }
    >
      {ready && db && projectId && id ? (
        <LookAheadDetail db={db} projectId={projectId} lookAheadId={id} />
      ) : (
        <View className="items-center py-12"><Spinner size="md" /></View>
      )}
    </Page>
  );
}
