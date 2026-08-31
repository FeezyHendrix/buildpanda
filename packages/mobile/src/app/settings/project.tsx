import { router } from "expo-router";
import { Switch, View } from "react-native";
import { Card, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { useProjectSettings, useUpdateProjectSettings } from "@/hooks/use-project-settings";
import { useProject } from "@/hooks/use-projects";
import { useFieldSession } from "@/lib/field-session";
import { useSyncState } from "@/lib/sync-provider";

export default function ProjectSettingsScreen() {
  const { projectId } = useFieldSession();
  const { data: project } = useProject(projectId);
  const { data: settings, isPending } = useProjectSettings(projectId);
  const save = useUpdateProjectSettings(projectId);
  const { isOnline } = useSyncState();

  const aiUpdatesEnabled = save.isPending
    ? (save.variables?.aiUpdatesEnabled ?? settings?.aiUpdatesEnabled ?? true)
    : (settings?.aiUpdatesEnabled ?? true);

  return (
    <Page title="Project settings" description={project?.name} onBack={() => router.back()}>
      {!isOnline ? (
        <View className="mb-4 rounded-xl bg-surface-alt px-4 py-3">
          <Text tone="secondary" className="text-[13px]">
            You need a connection to change project settings.
          </Text>
        </View>
      ) : null}

      {isPending ? (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      ) : (
        <Card className="p-4">
          <View className="flex-row items-center gap-3">
            <View className="min-w-0 flex-1">
              <Text weight="semibold" className="text-[15px]">
                Panda AI weekly updates
              </Text>
              <Text tone="secondary" className="pt-1 text-[13px]">
                Panda AI drafts a weekly client update from this project&apos;s field data — daily
                logs, activities, deliveries and RFIs. Turn it off and only user-written updates
                are posted.
              </Text>
            </View>
            <Switch
              value={aiUpdatesEnabled}
              disabled={!isOnline || save.isPending}
              onValueChange={(next) => save.mutate({ aiUpdatesEnabled: next })}
              trackColor={{ true: "#004DE7", false: "#C8C8C8" }}
              accessibilityLabel="Panda AI weekly updates"
            />
          </View>
          {save.error ? (
            <Text tone="danger" className="pt-2 text-xs">
              {save.error instanceof Error ? save.error.message : "Could not save the setting."}
            </Text>
          ) : null}
        </Card>
      )}
    </Page>
  );
}
