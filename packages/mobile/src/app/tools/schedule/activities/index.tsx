import { ActivityRow } from "@/components/molecules/schedule/rows";
import { router } from "expo-router";
import { Pressable } from "react-native";
import { ScheduleListScreen } from "@/components/molecules/schedule/list-screen";
import { useActivities } from "@/hooks/use-activities";
import { useFieldSession } from "@/lib/field-session";

export default function Activities() {
  const { projectId } = useFieldSession();
  const activities = useActivities(projectId);
  const data = activities.data ?? [];

  return (
    <ScheduleListScreen
      title="Site activity"
      isPending={activities.isPending}
      isStale={activities.isStale}
      key={projectId}
      data={data}
      fields={(activity) => [activity.name, activity.phaseName, activity.location, activity.status]}
      emptyTitle="Nothing scheduled"
      emptyBody="Site activities for this project will appear here."
      renderItem={(activity) => (
        <Pressable
          key={activity.id}
          onPress={() => router.push(`/tools/schedule/activities/${activity.id}` as never)}
          accessibilityRole="button"
        >
          <ActivityRow activity={activity} />
        </Pressable>
      )}
    />
  );
}
