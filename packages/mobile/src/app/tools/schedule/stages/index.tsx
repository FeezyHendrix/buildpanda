import { StageRow } from "@/components/molecules/schedule/rows";
import { router } from "expo-router";
import { Pressable } from "react-native";
import { ScheduleListScreen } from "@/components/molecules/schedule/list-screen";
import { useStages } from "@/hooks/use-stages";
import { useFieldSession } from "@/lib/field-session";

export default function Stages() {
  const { projectId } = useFieldSession();
  const stages = useStages(projectId);
  const data = stages.data ?? [];

  return (
    <ScheduleListScreen
      title="Build stages"
      isPending={stages.isPending}
      isStale={stages.isStale}
      key={projectId}
      data={data}
      fields={(stage) => [stage.name, stage.status, stage.dateRange]}
      emptyTitle="No build stages"
      emptyBody="Stages break the build into phases with their own progress."
      renderItem={(stage) => (
        <Pressable
          key={stage.id}
          onPress={() => router.push(`/tools/schedule/stages/${stage.id}` as never)}
          accessibilityRole="button"
        >
          <StageRow stage={stage} />
        </Pressable>
      )}
    />
  );
}
