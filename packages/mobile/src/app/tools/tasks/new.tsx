import { useState } from "react";
import { Pressable, View } from "react-native";
import { TASK_PRIORITIES, type TaskAssignee, type TaskPriority } from "@/api/tasks";
import { Button, Field, FieldLabel, OptionRow, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { WorkspaceSheet } from "@/components/molecules/workspace-sheet";
import { useLocalDb } from "@/db/provider";
import { useProjectBuilding } from "@/hooks/use-project-building";
import { useAssignable, useCreateTask } from "@/hooks/use-tasks";
import { isIsoDate } from "@/lib/dates";
import { useFieldSession } from "@/lib/field-session";
import { goBack } from "@/lib/navigation";
import { useSyncState } from "@/lib/sync-provider";

// A task is a record the crew works from, so it is authored on a full page.
// It lands in To do on the current building's board.

export default function NewTask() {
  const { projectId } = useFieldSession();
  const { buildingId } = useProjectBuilding();
  const { db } = useLocalDb();
  const createTask = useCreateTask(db, projectId, buildingId);
  const assignable = useAssignable(projectId);
  const { isOnline } = useSyncState();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [assignee, setAssignee] = useState<TaskAssignee | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dueValid = dueDate.trim() === "" || isIsoDate(dueDate.trim());
  const canSubmit = title.trim().length > 0 && dueValid && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || null,
        dueDate: dueDate.trim() || null,
        priority,
        assignees: assignee ? [assignee] : [],
      });
      goBack();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not add this task.");
    }
  }

  return (
    <Page
      buildingScope
      title="New task"
      onBack={() => goBack()}
      footer={<Button onPress={submit} disabled={!canSubmit} loading={saving}>Add task</Button>}
    >
      <View className="gap-5">
        {error ? (
          <View className="rounded-xl bg-error-50 px-4 py-3"><Text tone="danger" className="text-sm">{error}</Text></View>
        ) : null}
        {!isOnline ? (
          <View className="rounded-xl bg-surface-alt px-4 py-3">
            <Text tone="secondary" className="text-[13px]">You&apos;re offline. This is saved on your device and uploads when you get signal.</Text>
          </View>
        ) : null}
        <Field label="Task" value={title} onChangeText={setTitle} placeholder="What needs doing?" autoFocus />
        <View className="gap-2">
          <FieldLabel>Assign to</FieldLabel>
          <Pressable accessibilityRole="button" accessibilityLabel={`Assign to: ${assignee?.name ?? "nobody"}`} onPress={() => setPicking(true)} className="min-h-14 justify-center rounded-xl border border-line bg-surface px-4">
            <Text className="text-sm">{assignee?.name ?? "Unassigned"}</Text>
          </Pressable>
        </View>
        <OptionRow label="Priority" options={TASK_PRIORITIES} value={priority} onChange={setPriority} />
        <Field
          label="Due date"
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="YYYY-MM-DD (optional)"
          autoCapitalize="none"
          error={dueValid ? undefined : "Enter a date as YYYY-MM-DD."}
        />
        <Field label="Details" value={description} onChangeText={setDescription} placeholder="Optional" multiline />
      </View>
      <WorkspaceSheet
        visible={picking}
        title="Assign to"
        loading={false}
        workspaces={[
          { id: "", name: "Unassigned" },
          ...assignable.map((a) => ({ id: `${a.kind}:${a.id}`, name: a.isSelf ? `${a.name} (me)` : a.name })),
        ]}
        activeId={assignee ? `${assignee.kind}:${assignee.id}` : ""}
        onSelect={(key) => {
          const found = assignable.find((a) => `${a.kind}:${a.id}` === key);
          setAssignee(found ? { kind: found.kind, id: found.id, name: found.name } : null);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </Page>
  );
}
