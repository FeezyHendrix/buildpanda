import { StageRow } from "@/components/molecules/schedule/rows";
import { ScheduleListScreen } from "@/components/molecules/schedule/list-screen";
import { useStages } from "@/hooks/use-stages";
import { useFieldSession } from "@/lib/field-session";

export default function Stages() {
  const { projectId } = useFieldSession();
  const stages = useStages(projectId);
  const data = stages.data ?? [];

  return (
    <ScheduleListScreen
      title="Build Stages"
      isPending={stages.isPending}
      isStale={stages.isStale}
      isEmpty={data.length === 0}
      emptyTitle="No build stages"
      emptyBody="Stages break the build into phases with their own progress."
    >
      {data.map((stage) => (
        <StageRow key={stage.id} stage={stage} />
      ))}
    </ScheduleListScreen>
  );
}
