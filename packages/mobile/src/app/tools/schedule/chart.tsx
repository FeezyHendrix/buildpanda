import { GanttChart } from "@/components/molecules/schedule/gantt-chart";
import { ScheduleListScreen } from "@/components/molecules/schedule/list-screen";
import { useActivities } from "@/hooks/use-activities";
import { useFieldSession } from "@/lib/field-session";

export default function ProjectChart() {
  const { projectId } = useFieldSession();
  const activities = useActivities(projectId);
  const data = activities.data ?? [];

  return (
    <ScheduleListScreen
      title="Project Chart"
      isPending={activities.isPending}
      isStale={activities.isStale}
      isEmpty={data.length === 0}
      emptyTitle="Nothing to chart"
      emptyBody="Activities with planned dates will appear here as a timeline."
    >
      <GanttChart activities={data} />
    </ScheduleListScreen>
  );
}
