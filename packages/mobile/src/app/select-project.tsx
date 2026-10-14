import { goBack } from "@/lib/navigation";
import { router } from "expo-router";
import { Pressable } from "react-native";
import { buildingsApi, realBuildings } from "@/api/buildings";
import { Text } from "@/components/atoms";
import { PickerScreen, type PickerItem } from "@/components/molecules/picker-screen";
import { useProjects } from "@/hooks/use-projects";
import { useFieldSession } from "@/lib/field-session";

export default function SelectProject() {
  const { projectId, selectProject, selectBuilding } = useFieldSession();
  const { data, isPending, error, isStale, refetch } = useProjects();

  const items: PickerItem[] = (data ?? []).map((project) => ({
    id: project.id,
    label: project.name,
    sublabel: project.address,
  }));

  function handleSelect(id: string) {
    selectProject(id);
    router.replace("/(tabs)/overview");
    // Resolve the one real building now, while there is probably signal: the
    // daily log and task board are keyed by building locally, so going offline
    // before opening a building-scoped screen used to make them unsaveable.
    void buildingsApi
      .list(id)
      .then((all) => {
        const real = realBuildings(all);
        if (real.length === 1) selectBuilding(real[0]!.id);
      })
      .catch(() => undefined);
  }

  return (
    <PickerScreen
      title="Choose a project"
      onBack={projectId ? goBack : undefined}
      description="Everything you capture in Field Tools is filed against this project."
      items={items}
      activeId={projectId}
      loading={isPending}
      isStale={isStale}
      errorMessage={error && !data ? error.message : undefined}
      onRetry={() => { void refetch(); }}
      searchPlaceholder="Search projects"
      emptyTitle="No projects in this workspace"
      emptyDescription="Pick a different workspace, or ask your project manager to add you to a project."
      onSelect={handleSelect}
      footer={
        <Pressable
          onPress={() => router.push("/select-workspace")}
          accessibilityRole="button"
          className="min-h-11 justify-center"
        >
          <Text weight="semibold" tone="brand" className="text-center text-sm">
            Switch workspace
          </Text>
        </Pressable>
      }
    />
  );
}
