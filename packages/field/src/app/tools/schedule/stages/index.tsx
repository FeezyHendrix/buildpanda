import { withProjectPermission } from "@/components/molecules/permission-gate";
import { StageRow } from "@/components/molecules/schedule/rows";
import { router } from "@/navigation";
import { ScheduleListScreen } from "@/components/molecules/schedule/list-screen";
import { useStages } from "@/hooks/use-stages";
import { useFieldSession } from "@/lib/field-session";
function Stages() {
    const { projectId } = useFieldSession();
    const stages = useStages(projectId);
    const data = stages.data ?? [];
    return (<ScheduleListScreen title="Build stages" isPending={stages.isPending} isStale={stages.isStale} key={projectId} data={data} fields={(stage) => [stage.name, stage.status, stage.dateRange]} emptyTitle="No build stages" emptyBody="Stages break the build into phases with their own progress." renderItem={(stage) => (<button key={stage.id} onClick={() => router.push(`/tools/schedule/stages/${stage.id}` as never)} role="button" type="button">
          <StageRow stage={stage}/>
        </button>)}/>);
}
export default withProjectPermission(Stages, "/tools/schedule/stages");
