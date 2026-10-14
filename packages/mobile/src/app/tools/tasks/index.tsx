import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Card, PendingBadge, Spinner, Text } from "@/components/atoms";
import { BuildingUnavailable } from "@/components/molecules/building-unavailable";
import { HeaderIconButton } from "@/components/molecules/header-icon-button";
import { Page } from "@/components/molecules/page";
import { SegmentedTabs } from "@/components/molecules/segmented-tabs";
import { ICON_FAINT } from "@/constants/colors";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import type { TaskRow } from "@/db/schema";
import { parseAssignees } from "@/db/tasks-repository";
import { useProjectAccess } from "@/hooks/use-project-access";
import { useProjectBuilding } from "@/hooks/use-project-building";
import { useTaskBoard } from "@/hooks/use-tasks";
import { formatShortDate } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";
import { goBack } from "@/lib/navigation";

type Tab = "mine" | "all";
const TABS = [
  { key: "mine", label: "My tasks" },
  { key: "all", label: "All tasks" },
] as const;

function taskMeta(row: TaskRow): string {
  const names = parseAssignees(row.assignees).map((a) => a.name);
  return [
    row.dueDate ? `Due ${formatShortDate(row.dueDate)}` : null,
    row.priority === "High" ? "High priority" : null,
    names.length ? names.join(", ") : "Unassigned",
    row.subtaskTotal ? `${row.subtaskDone}/${row.subtaskTotal} done` : null,
  ].filter(Boolean).join(" · ");
}

function TaskList({ db, projectId, buildingId, full, tab }: { db: Db; projectId: string; buildingId: string; full: boolean; tab: Tab }) {
  const board = useTaskBoard(db, projectId, buildingId, full);
  if (board.isPending) return <View className="items-center py-12"><Spinner size="md" /></View>;

  const visible = tab === "all" ? board.tasks : board.tasks.filter((t) => t.assignedToMe || !full);
  if (visible.length === 0) {
    return (
      <View className="items-center py-12">
        <Text weight="semibold" className="text-center text-base">{tab === "all" ? "No tasks on this board" : "Nothing assigned to you"}</Text>
        <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">
          {tab === "all" ? "Add a task with the + button and it lands in To do." : "Tasks assigned to you show up here, ready to work offline."}
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-6">
      {board.columns.map((column) => {
        const inColumn = visible.filter((t) => t.columnId === column.id);
        if (inColumn.length === 0) return null;
        return (
          <View key={column.id} className="gap-2">
            <Text weight="semibold" className="text-base">{column.name} <Text tone="secondary" className="text-sm">{inColumn.length}</Text></Text>
            <Card>
              {inColumn.map((task, index) => (
                <Pressable
                  key={task.id}
                  accessibilityRole="button"
                  onPress={() => router.push(`/tools/tasks/${encodeURIComponent(task.id)}`)}
                  className={`min-h-16 flex-row items-center gap-3 px-4 py-3 active:bg-surface-alt ${index ? "border-t border-hairline" : ""}`}
                >
                  <View className="min-w-0 flex-1">
                    <Text weight="semibold" className="text-[15px]" numberOfLines={2}>{task.title}</Text>
                    <Text tone="secondary" className="pt-0.5 text-xs" numberOfLines={1}>{taskMeta(task)}</Text>
                  </View>
                  {task.isPendingSync ? <PendingBadge /> : null}
                  <Ionicons name="chevron-forward" size={18} color={ICON_FAINT} />
                </Pressable>
              ))}
            </Card>
          </View>
        );
      })}
    </View>
  );
}

export default function Tasks() {
  const { projectId } = useFieldSession();
  const { buildingId, isLoading: buildingsLoading, refetch: reloadBuildings } = useProjectBuilding();
  const { db, ready } = useLocalDb();
  const { can } = useProjectAccess();
  // Managers see the whole board; everyone else only their own tasks.
  const full = can("tasks", "add");
  const [tab, setTab] = useState<Tab>("mine");

  return (
    <Page
      buildingScope
      title="Tasks"
      onBack={() => goBack()}
      rightButtons={full ? <HeaderIconButton icon="add" label="New task" onPress={() => router.push("/tools/tasks/new")} /> : undefined}
    >
      <View className="gap-4">
        {full ? <SegmentedTabs tabs={TABS} active={tab} onChange={setTab} /> : null}
        {ready && db && projectId && buildingId ? (
          <TaskList key={`${projectId}:${buildingId}`} db={db} projectId={projectId} buildingId={buildingId} full={full} tab={full ? tab : "mine"} />
        ) : !ready || buildingsLoading ? (
          <View className="items-center py-12"><Spinner size="md" /></View>
        ) : (
          <BuildingUnavailable onReload={() => void reloadBuildings()} />
        )}
      </View>
    </Page>
  );
}
