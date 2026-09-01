import { ActivityRow } from "@/components/molecules/schedule/rows";
import { ScheduleListScreen } from "@/components/molecules/schedule/list-screen";
import { useActivities } from "@/hooks/use-activities";
import { useFieldSession } from "@/lib/field-session";

export default function Activities() {
  const { projectId } = useFieldSession();
  const activities = useActivities(projectId);
  const data = activities.data ?? [];

  return (
    <ScheduleListScreen
      title="Site Activity"
      isPending={activities.isPending}
      isStale={activities.isStale}
      isEmpty={data.length === 0}
      emptyTitle="Nothing scheduled"
      emptyBody="Site activities for this project will appear here."
    >
      {data.map((activity) => (
        <ActivityRow key={activity.id} activity={activity} />
      ))}
    </ScheduleListScreen>
  );
}
