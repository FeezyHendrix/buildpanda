import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Card, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { ICON_BRAND, ICON_MUTED } from "@/constants/colors";
import { useProject } from "@/hooks/use-projects";
import { useFieldSession } from "@/lib/field-session";

interface Tool { label: string; helper: string; icon: React.ComponentProps<typeof Ionicons>["name"]; href: string }
const GROUPS: { title: string; tools: Tool[] }[] = [
  { title: "Plan and track", tools: [
    { label: "Schedule", helper: "Build stages, activities and key dates", icon: "calendar-outline", href: "/(tabs)/schedule" },
    { label: "Daily log", helper: "People, weather and work on site", icon: "clipboard-outline", href: "/tools/daily-log" },
    { label: "Look aheads", helper: "Plan the next stretch of work", icon: "list-outline", href: "/tools/look-aheads" },
    { label: "Updates", helper: "Progress and reports from the team", icon: "chatbubbles-outline", href: "/tools/updates" },
  ] },
  { title: "Coordinate", tools: [
    { label: "RFIs", helper: "Requests for information", icon: "help-circle-outline", href: "/tools/rfis" },
    { label: "Change requests", helper: "Scope, cost and time changes", icon: "swap-horizontal-outline", href: "/tools/change-requests" },
    { label: "Materials", helper: "Orders and deliveries", icon: "cube-outline", href: "/tools/materials" },
    { label: "Material approvals", helper: "Review before ordering or installing", icon: "checkmark-done-outline", href: "/tools/material-approvals" },
  ] },
];

export default function Site() {
  const { projectId } = useFieldSession();
  const project = useProject(projectId);
  return (
    <Page stageScope title="Site" projectName={project.data?.name} projectPending={project.isPending} onPressProject={() => router.push("/select-project")}>
      <Pressable accessibilityRole="button" onPress={() => router.push("/tools/panda-ai")} className="min-h-20 flex-row items-center gap-3 rounded-xl bg-primary-50 px-4 py-4">
        <Ionicons name="sparkles-outline" size={24} color={ICON_BRAND} />
        <View className="flex-1">
          <Text variant="heading" weight="semibold" className="text-lg">Panda AI</Text>
          <Text tone="secondary" className="pt-1 text-xs">Ask about your project</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color={ICON_BRAND} />
      </Pressable>
      {GROUPS.map((group) => (
        <View key={group.title} className="pt-6">
          <Text variant="heading" weight="semibold" className="pb-3 text-lg">{group.title}</Text>
          <Card>{group.tools.map((tool, index) => (
            <Pressable key={tool.href} accessibilityRole="button" onPress={() => router.push(tool.href as never)} className={`min-h-20 flex-row items-center gap-3 px-4 py-3 active:bg-surface-alt ${index ? "border-t border-line" : ""}`}>
              <View className="h-10 w-10 items-center justify-center rounded-lg bg-surface-alt"><Ionicons name={tool.icon} size={20} color={ICON_BRAND} /></View>
              <View className="min-w-0 flex-1">
                <Text weight="medium" className="text-sm">{tool.label}</Text>
                <Text tone="secondary" className="pt-1 text-xs">{tool.helper}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={ICON_MUTED} />
            </Pressable>
          ))}</Card>
        </View>
      ))}
    </Page>
  );
}
