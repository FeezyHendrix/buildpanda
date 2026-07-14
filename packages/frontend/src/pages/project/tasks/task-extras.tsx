import { useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Label } from "@/components/atoms/label";
import { ComboSelect, type ComboItem } from "@/components/molecules/combo-select";
import {
  useTaskDetail,
  useAddSubtask,
  useUpdateSubtask,
  useDeleteSubtask,
  useAddLink,
  useDeleteLink,
} from "@/hooks/use-tasks";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Task, TaskLinkType } from "@/lib/project-types";
import { FIELD, LINK_TYPE_LABELS, LINK_TYPE_ORDER, LINK_TYPE_TONE } from "./task-ui";
import { TaskEntityLinks } from "./task-entity-links";
import { TaskComments } from "./task-comments";

export function TaskExtras({
  projectId,
  taskId,
  allTasks,
  onOpenTask,
}: {
  projectId: string;
  taskId: string;
  allTasks: Task[];
  onOpenTask?: (taskId: string) => void;
}) {
  const { data: detail } = useTaskDetail(projectId, taskId);
  const addSubtask = useAddSubtask(projectId, taskId);
  const updateSubtask = useUpdateSubtask(projectId, taskId);
  const deleteSubtask = useDeleteSubtask(projectId, taskId);
  const addLink = useAddLink(projectId, taskId);
  const deleteLink = useDeleteLink(projectId, taskId);

  const [newSubtask, setNewSubtask] = useState("");
  const [linkTarget, setLinkTarget] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<TaskLinkType>("relates_to");

  const linkedTargetIds = new Set((detail?.links ?? []).map((l) => l.targetTaskId));
  const linkableItems = useMemo<ComboItem[]>(
    () =>
      allTasks
        .filter((t) => t.id !== taskId && !linkedTargetIds.has(t.id))
        .map((t) => ({ id: t.id, label: t.title })),
    [allTasks, taskId, detail?.links],
  );

  const groupedLinks = useMemo(() => {
    const groups = new Map<TaskLinkType, NonNullable<typeof detail>["links"]>();
    for (const link of detail?.links ?? []) {
      const list = groups.get(link.linkType) ?? [];
      list.push(link);
      groups.set(link.linkType, list);
    }
    return LINK_TYPE_ORDER.filter((t) => groups.has(t)).map((t) => ({
      type: t,
      links: groups.get(t)!,
    }));
  }, [detail?.links]);

  function submitSubtask(): void {
    const title = newSubtask.trim();
    if (!title) return;
    addSubtask.mutate(title, { onSuccess: () => setNewSubtask(""), onError: () => toast("Could not add subtask") });
  }

  function submitLink(): void {
    if (!linkTarget) return;
    addLink.mutate(
      { targetTaskId: linkTarget, linkType },
      {
        onSuccess: () => setLinkTarget(null),
        onError: (err) => {
          const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
          toast(message ?? "Could not link task");
        },
      },
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label>Subtasks{detail && detail.subtasks.length > 0 ? ` (${detail.subtaskDone}/${detail.subtaskTotal})` : ""}</Label>
        <div className="flex flex-col gap-1">
          {detail?.subtasks.map((st) => (
            <div key={st.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={st.done}
                onChange={(e) => updateSubtask.mutate({ subtaskId: st.id, done: e.target.checked })}
                className="size-4 rounded border-gray-300 text-[#004DE7] focus:ring-[#004DE7]"
              />
              <span className={cn("flex-1 text-sm", st.done ? "text-gray-400 line-through" : "text-gray-700")}>
                {st.title}
              </span>
              <button
                type="button"
                onClick={() => deleteSubtask.mutate(st.id)}
                aria-label="Remove subtask"
                className="text-gray-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitSubtask(); } }}
            placeholder="Add a subtask"
            className={cn(FIELD, "h-9 flex-1")}
          />
          <Button variant="ghost" size="sm" onClick={submitSubtask} disabled={!newSubtask.trim()}>
            Add
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Label>Related tasks{detail && detail.links.length > 0 ? ` (${detail.links.length})` : ""}</Label>

        {groupedLinks.length === 0 ? (
          <p className="text-xs text-gray-400">No related tasks yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {groupedLinks.map((group) => (
              <div key={group.type} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", LINK_TYPE_TONE[group.type])}>
                    {LINK_TYPE_LABELS[group.type]}
                  </span>
                  <span className="text-[11px] text-gray-400">{group.links.length}</span>
                </div>
                {group.links.map((link) => (
                  <div key={link.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-gray-50">
                    <button
                      type="button"
                      onClick={() => onOpenTask?.(link.targetTaskId)}
                      className="flex-1 truncate text-left text-sm text-gray-700 hover:text-[#004DE7]"
                      title="Open task"
                    >
                      {link.targetTaskTitle}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteLink.mutate(link.id)}
                      aria-label="Remove link"
                      className="text-gray-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {linkableItems.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl bg-[#FAFAFA] p-2">
            <div className="flex gap-2">
              <select
                value={linkType}
                onChange={(e) => setLinkType(e.target.value as TaskLinkType)}
                className={cn(FIELD, "h-9 w-36 shrink-0")}
              >
                {LINK_TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>{LINK_TYPE_LABELS[t]}</option>
                ))}
              </select>
              <div className="min-w-0 flex-1">
                <ComboSelect
                  items={linkableItems}
                  value={linkTarget}
                  onChange={setLinkTarget}
                  placeholder="Search a task to link…"
                  searchPlaceholder="Search tasks…"
                  emptyText="No tasks found"
                  className="h-9"
                />
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={submitLink} disabled={!linkTarget} className="self-end">
              Add relation
            </Button>
          </div>
        )}
      </div>
      <TaskEntityLinks projectId={projectId} taskId={taskId} entityLinks={detail?.entityLinks ?? []} />

      <TaskComments projectId={projectId} taskId={taskId} />
    </>
  );
}

TaskExtras.displayName = "TaskExtras";
