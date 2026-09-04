import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { router } from "expo-router";
import { FlatList, Pressable, View, useWindowDimensions } from "react-native";
import { Card, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { UpdateCard } from "@/components/molecules/update-card";
import { WorkspaceSheet } from "@/components/molecules/workspace-sheet";
import { TabletMinWidth } from "@/constants/theme";
import { useOrganizations, useSetActiveOrganization } from "@/hooks/use-organizations";
import { useProject } from "@/hooks/use-projects";
import { useProjectUpdates } from "@/hooks/use-updates";
import { useFieldSession } from "@/lib/field-session";
import { cn } from "@/lib/utils";

interface FieldTool {
  key: string;
  label: string;
  helper: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  href?: string;
}

const TOOLS: readonly FieldTool[] = [
  { key: "daily-log", label: "Daily Log", helper: "Today's field report", icon: "clipboard-outline", href: "/tools/daily-log" },
  { key: "rfis", label: "RFIs", helper: "Requests for information", icon: "help-circle-outline", href: "/tools/rfis" },
  {
    key: "change-requests",
    label: "Change Requests",
    helper: "Scope changes",
    icon: "swap-horizontal-outline",
    href: "/tools/change-requests",
  },
  { key: "materials", label: "Materials", helper: "Orders & requests", icon: "cube-outline", href: "/tools/materials" },
] as const;

function ToolCard({ tool, isWide }: { tool: FieldTool; isWide: boolean }) {
  return (
    <Pressable onPress={tool.href ? () => router.push(tool.href as never) : undefined} className={isWide ? "w-[31.5%]" : "w-[48.5%]"}>
    <Card className="min-h-32 justify-between p-4">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-50">
        <Ionicons name={tool.icon} size={20} color="#004DE7" />
      </View>
      <View className="pt-3">
        <Text weight="semibold" className="text-[15px]">
          {tool.label}
        </Text>
        <Text tone="secondary" className="pt-0.5 text-xs">
          {tool.helper}
        </Text>
      </View>
    </Card>
    </Pressable>
  );
}

export default function ToolsTab() {
  const { width } = useWindowDimensions();
  const { projectId, organizationId } = useFieldSession();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | undefined>(undefined);
  const isWide = width >= TabletMinWidth;

  const { data: organizations } = useOrganizations();
  const { data: project } = useProject(projectId);
  const { data: updates } = useProjectUpdates(projectId);
  const setActive = useSetActiveOrganization();

  return (
    <Page
      title="Field Tools"
      description={project?.address}
      workspaceName={(organizations ?? []).find((o) => o.id === organizationId)?.name}
      projectName={project?.name ?? "Loading project…"}
      onPressWorkspace={() => setSheetOpen(true)}
      onPressProject={() => router.push("/select-project")}
      scroll={false}
    >
      <View className="flex-row flex-wrap gap-3">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.key} tool={tool} isWide={isWide} />
        ))}
      </View>

      {/* The grid stays put and only the feed moves, so the tools a crew member
          reaches for are always in the same place on the screen. */}
      <View className="mt-6 min-w-0 flex-1">
        <View className="flex-row items-center justify-between pb-3">
          <Text weight="semibold" className="text-base">
            Updates
          </Text>
          <Pressable
            onPress={() => router.push("/tools/updates" as never)}
            accessibilityRole="button"
            className="min-h-11 justify-center"
          >
            <Text weight="semibold" tone="brand" className="text-[13px]">
              See all
            </Text>
          </Pressable>
        </View>
        <FlatList
          data={updates ?? []}
          keyExtractor={(update) => update.id}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="gap-3 pb-6"
          renderItem={({ item }) => (
            <UpdateCard
              update={item}
              onPress={() => router.push(`/tools/updates/${item.id}` as never)}
            />
          )}
          ListEmptyComponent={
            <Text tone="secondary" className="py-8 text-center text-[13px]">
              No updates have been posted for this project yet.
            </Text>
          }
        />
      </View>

      <WorkspaceSheet
        visible={sheetOpen}
        workspaces={(organizations ?? []).map((o) => ({ id: o.id, name: o.name }))}
        activeId={organizationId}
        busyId={switchingId}
        onClose={() => setSheetOpen(false)}
        onSelect={async (id) => {
          if (id === organizationId) {
            setSheetOpen(false);
            return;
          }
          setSwitchingId(id);
          try {
            await setActive.mutateAsync(id);
            router.replace("/");
          } finally {
            setSwitchingId(undefined);
            setSheetOpen(false);
          }
        }}
      />
    </Page>
  );
}
