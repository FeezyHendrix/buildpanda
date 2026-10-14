import { features } from "@/lib/feature-access";
import { PermissionGate, withProjectPermission } from "@/components/molecules/permission-gate";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Card, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { ICON_BRAND, ICON_MUTED } from "@/constants/colors";
import { useAllowedTools } from "@/hooks/use-home-tools";
import { useProject } from "@/hooks/use-projects";
import { useFieldSession } from "@/lib/field-session";
import type { HomeToolKey } from "@/lib/home-tools";

// Every tool, grouped. Home leads with the ones this person uses most; this is
// where the rest live. Labels and permissions come from the Home catalogue.

const GROUPS: { title: string; tools: { key: HomeToolKey; label?: string; helper: string }[] }[] = [
  { title: "On site", tools: [
    { key: "dailyLog", helper: "People, weather and work on site" },
    { key: "tasks", helper: "Your tasks and the building's board" },
    { key: "materialLog", helper: "Deliveries received and stock on hand" },
    { key: "expenses", helper: "Site spending with receipts" },
    { key: "updates", helper: "Progress and reports from the team" },
  ] },
  { title: "Plan and track", tools: [
    { key: "schedule", helper: "Build stages, activities and key dates" },
    { key: "lookAheads", helper: "Plan the next stretch of work" },
    { key: "plans", label: "Plan review", helper: "Mark up drawings on site" },
  ] },
  { title: "Coordinate", tools: [
    { key: "rfis", helper: "Requests for information" },
    { key: "changeRequests", label: "Change requests", helper: "Scope, cost and time changes" },
    { key: "materialOrders", label: "Material orders", helper: "Request materials and track deliveries" },
    { key: "materialApprovals", label: "Material approvals", helper: "Review before ordering or installing" },
  ] },
];

function Tools() {
  const { projectId } = useFieldSession();
  const project = useProject(projectId);
  const allowed = new Map(useAllowedTools().map((tool) => [tool.key, tool]));

  return (
    <Page stageScope title="Tools" projectName={project.data?.name} projectPending={project.isPending} onPressProject={() => router.push("/select-project")}>
      <PermissionGate permission={features.project.read}><Pressable accessibilityRole="button" onPress={() => router.push("/tools/panda-ai")} className="min-h-20 flex-row items-center gap-3 rounded-xl bg-primary-50 px-4 py-4">
        <Ionicons name="sparkles-outline" size={24} color={ICON_BRAND} />
        <View className="flex-1">
          <Text variant="heading" weight="semibold" className="text-lg">Panda AI</Text>
          <Text tone="secondary" className="pt-1 text-xs">Ask about your project</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color={ICON_BRAND} />
      </Pressable></PermissionGate>
      {GROUPS.map((group) => {
        const tools = group.tools.flatMap((entry) => {
          const tool = allowed.get(entry.key);
          return tool ? [{ ...tool, label: entry.label ?? tool.label, helper: entry.helper }] : [];
        });
        if (tools.length === 0) return null;
        return (
          <View key={group.title} className="pt-6">
            <Text variant="heading" weight="semibold" className="pb-3 text-lg">{group.title}</Text>
            <Card>{tools.map((tool, index) => (
              <Pressable key={tool.key} accessibilityRole="button" onPress={() => router.push(tool.href as never)} className={`min-h-20 flex-row items-center gap-3 px-4 py-3 active:bg-surface-alt ${index ? "border-t border-line" : ""}`}>
                <View className="h-10 w-10 items-center justify-center rounded-lg bg-surface-alt"><Ionicons name={tool.icon} size={20} color={ICON_BRAND} /></View>
                <View className="min-w-0 flex-1">
                  <Text weight="medium" className="text-sm">{tool.label}</Text>
                  <Text tone="secondary" className="pt-1 text-xs">{tool.helper}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={ICON_MUTED} />
              </Pressable>
            ))}</Card>
          </View>
        );
      })}
    </Page>
  );
}

export default withProjectPermission(Tools, "/(tabs)/tools");
