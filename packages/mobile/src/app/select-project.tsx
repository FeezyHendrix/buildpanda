import { router } from "expo-router";
import { Pressable, Text } from "react-native";
import { PickerScreen, type PickerItem } from "@/components/molecules/picker-screen";
import { useProjects } from "@/hooks/use-projects";
import { useFieldSession } from "@/lib/field-session";

export default function SelectProject() {
  const { projectId, selectProject } = useFieldSession();
  const { data, isPending, error, isStale } = useProjects();

  const items: PickerItem[] = (data ?? []).map((project) => ({
    id: project.id,
    label: project.name,
    sublabel: project.address,
  }));

  function handleSelect(id: string) {
    selectProject(id);
    router.replace("/(tabs)");
  }

  return (
    <PickerScreen
      title="Choose a project"
      description="Everything you capture in Field Tools is filed against this project."
      items={items}
      activeId={projectId}
      loading={isPending}
      errorMessage={isStale ? "Showing your last synced projects — you're offline." : error && !data ? error.message : undefined}
      searchPlaceholder="Search projects"
      emptyTitle="No projects in this workspace"
      emptyDescription="Pick a different workspace, or ask your project manager to add you to a project."
      onSelect={handleSelect}
      footer={
        <Pressable onPress={() => router.push("/select-workspace")} accessibilityRole="button">
          <Text className="py-3 text-center text-sm font-semibold text-primary-500">
            Switch workspace
          </Text>
        </Pressable>
      }
    />
  );
}
