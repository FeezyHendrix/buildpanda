import { withProjectPermission } from "@/components/molecules/permission-gate";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { OptionRow, PendingBadge, Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { DetailFields } from "@/components/molecules/schedule/detail-fields";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { parseAssignees } from "@/db/tasks-repository";
import { useProjectAccess } from "@/hooks/use-project-access";
import { useMoveTask, useTask, useTaskBoard } from "@/hooks/use-tasks";
import { formatDate } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";
import { goBack } from "@/lib/navigation";

// Status is the board column, so moving a task is how its status changes. The
// rest of a task (subtasks, links, comments) is worked on the web.

function TaskDetail({ db, projectId, taskId }: { db: Db; projectId: string; taskId: string }) {
  const { data: task, isPending } = useTask(db, taskId);
  const {  snapshot } = useProjectAccess();
  const board = useTaskBoard(db, projectId, task?.buildingId ?? "", snapshot?.capabilities.canSeeFullTaskBoard === true);
  const moveTask = useMoveTask(db, projectId);
  const [error, setError] = useState<string | null>(null);

  if (isPending) return <View className="items-center py-12"><Spinner size="md" /></View>;
  if (!task) {
    return (
      <View className="items-center py-12">
        <Text weight="semibold" className="text-center text-base">Task not found</Text>
        <Text tone="secondary" className="px-6 pt-2 text-center text-[13px]">It may have been deleted or reassigned.</Text>
      </View>
    );
  }

  async function move(columnId: string) {
    if (!task || columnId === task.columnId) return;
    setError(null);
    try {
      await moveTask(task.id, columnId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move this task.");
    }
  }

  const assignees = parseAssignees(task.assignees).map((a) => a.name);
  return (
    <View className="gap-5">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text weight="bold" className="flex-1 text-lg">{task.title}</Text>
        {task.isPendingSync ? <PendingBadge /> : null}
      </View>
      {error ? (
        <View className="rounded-xl bg-error-50 px-4 py-3"><Text tone="danger" className="text-sm">{error}</Text></View>
      ) : null}
      {board.columns.length > 0 ? (
        <OptionRow
          label="Status"
          options={board.columns.map((c) => ({ value: c.id, label: c.name }))}
          value={task.columnId}
          onChange={(next) => void move(next)}
        />
      ) : null}
      <DetailFields
        fields={[
          { label: "Due", value: task.dueDate ? formatDate(task.dueDate) : null },
          { label: "Priority", value: task.priority },
          { label: "Assigned to", value: assignees.join(", ") || "Unassigned" },
          { label: "Checklist", value: task.subtaskTotal ? `${task.subtaskDone} of ${task.subtaskTotal} done` : null },
          { label: "Created by", value: task.createdByName },
        ]}
      />
      {task.description ? (
        <View className="gap-2">
          <Text weight="semibold" tone="secondary" className="text-xs uppercase tracking-wide">Description</Text>
          <Text className="text-[15px]">{task.description}</Text>
        </View>
      ) : null}
    </View>
  );
}

function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projectId } = useFieldSession();
  const { db, ready } = useLocalDb();
  return (
    <Page title="Task" onBack={() => goBack()}>
      {ready && db && projectId && id ? (
        <TaskDetail key={id} db={db} projectId={projectId} taskId={id} />
      ) : (
        <View className="items-center py-12"><Spinner size="md" /></View>
      )}
    </Page>
  );
}

export default withProjectPermission(TaskDetailScreen, "/tools/tasks/[id]");
