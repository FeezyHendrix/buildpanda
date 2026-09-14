import { useState, type SetStateAction } from "react";
import { useDraftState } from "@/hooks/use-draft-state";
import type { Task, TaskPriority } from "@/lib/project-types";

interface TaskDraft {
  title: string;
  description: string;
  descriptionHtml: string;
  assigneeValues: string[];
  dueDate: string;
  priority: TaskPriority;
  labels: string[];
  labelDraft: string;
}

function initialDraft(task: Task | null): TaskDraft {
  const assignees = task?.assignees ?? [];
  const legacyAssignee = task?.assigneeId ? `user:${task.assigneeId}` : null;
  const legacyTeam = task?.assigneeTeamMemberId ? `team:${task.assigneeTeamMemberId}` : null;
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    descriptionHtml: task?.descriptionHtml ?? task?.description ?? "",
    assigneeValues: assignees.length
      ? assignees.map(assignee => `${assignee.kind}:${assignee.id}`)
      : [legacyAssignee ?? legacyTeam].filter((id): id is string => Boolean(id)),
    dueDate: task?.dueDate?.slice(0, 10) ?? "",
    priority: task?.priority ?? "Medium",
    labels: task?.labels ?? [],
    labelDraft: "",
  };
}

export function useTaskDraft(projectId: string, task: Task | null) {
  const [initial] = useState(() => initialDraft(task));
  const [saved, setSaved, clear] = useDraftState<TaskDraft | null>(`task:${projectId}:${task?.id ?? "new"}`, null);

  function update(patch: Partial<TaskDraft>) {
    setSaved(previous => {
      const current = previous ?? initial;
      const changed = Object.entries(patch).some(([key, value]) => current[key as keyof TaskDraft] !== value);
      return changed ? { ...current, ...patch } : previous;
    });
  }

  function setField<K extends keyof TaskDraft>(key: K, value: SetStateAction<TaskDraft[K]>) {
    setSaved(previous => {
      const current = previous ?? initial;
      const next = typeof value === "function" ? value(current[key]) : value;
      return Object.is(next, current[key]) ? previous : { ...current, [key]: next };
    });
  }

  return { draft: saved ?? initial, dirty: saved !== null, update, setField, clear };
}
