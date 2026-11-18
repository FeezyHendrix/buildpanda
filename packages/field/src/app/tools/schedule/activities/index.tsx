import { withProjectPermission } from "@/components/molecules/permission-gate";
import { ActivityRow } from "@/components/molecules/schedule/rows";
import { router } from "@/navigation";
import { ScheduleListScreen } from "@/components/molecules/schedule/list-screen";
import { useActivities } from "@/hooks/use-activities";
import { useFieldSession } from "@/lib/field-session";
function Activities() {
    const { projectId } = useFieldSession();
    const activities = useActivities(projectId);
    const data = activities.data ?? [];
    return (<ScheduleListScreen title="Site activity" isPending={activities.isPending} isStale={activities.isStale} key={projectId} data={data} fields={(activity) => [activity.name, activity.phaseName, activity.location, activity.status]} emptyTitle="Nothing scheduled" emptyBody="Site activities for this project will appear here." renderItem={(activity) => (<button key={activity.id} onClick={() => router.push(`/tools/schedule/activities/${activity.id}` as never)} role="button" type="button">
          <ActivityRow activity={activity}/>
        </button>)}/>);
}
export default withProjectPermission(Activities, "/tools/schedule/activities");
