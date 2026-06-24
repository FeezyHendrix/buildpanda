import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Combobox } from "@base-ui-components/react/combobox";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { Avatar } from "@/components/atoms/avatar";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { PageHeader } from "@/components/molecules/page-header";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { RichTextEditor } from "@/components/molecules/rich-text-editor";
import { Label } from "@/components/atoms/label";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useTaskBoard,
  useAssignableUsers,
  useCreateTask,
  useUpdateTask,
  useMoveTask,
  useDeleteTask,
  useAddColumn,
  useRenameColumn,
  useDeleteColumn,
  useReorderColumns,
  useTaskDetail,
  useAddSubtask,
  useUpdateSubtask,
  useDeleteSubtask,
  useAddLink,
  useDeleteLink,
} from "@/hooks/use-tasks";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { formatDayMonth } from "@/lib/formatters";
import { Badge } from "@/components/atoms/badge";
import { resolveFileUrl } from "@/hooks/use-files";
import type { Task, TaskColumn, TaskLinkType, TaskPriority } from "@/lib/project-types";

// Priority styling maps each level to a design-system Badge tone (colours live
// in the Badge atom, never hardcoded here) plus a distinct shape, so the level
// reads without relying on colour — robust for colour-blind users (WCAG 1.4.1).
const PRIORITY_META: Record<
  TaskPriority,
  { tone: "info" | "warning" | "danger"; shape: "down" | "dash" | "up" }
> = {
  Low: { tone: "info", shape: "down" },
  Medium: { tone: "warning", shape: "dash" },
  High: { tone: "danger", shape: "up" },
};

const PRIORITY_ORDER: TaskPriority[] = ["Low", "Medium", "High"];

function PriorityIcon({ shape }: { shape: "down" | "dash" | "up" }) {
  return (
    <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {shape === "down" && <polyline points="6 9 12 15 18 9" />}
      {shape === "dash" && <line x1="5" y1="12" x2="19" y2="12" />}
      {shape === "up" && <polyline points="6 15 12 9 18 15" />}
    </svg>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const meta = PRIORITY_META[priority];
  return (
    <Badge tone={meta.tone} size="sm">
      <PriorityIcon shape={meta.shape} />
      {priority}
    </Badge>
  );
}

// The first image embedded in a task's description (data-file-id) becomes the
// card cover. We parse the id out of the stored HTML and resolve a fresh
// presigned URL on demand, mirroring the rich-text editor's resolution.
function firstImageFileId(html: string | null): string | null {
  if (!html) return null;
  const match = html.match(/data-file-id="([^"]+)"/);
  return match ? match[1]! : null;
}

interface AssigneeOption {
  kind: "user" | "team";
  id: string;
  name: string;
}

const FIELD =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

function htmlToText(html: string): string {
  const el = document.createElement("div");
  el.innerHTML = html;
  return (el.textContent ?? "").trim();
}

interface ComboItem {
  id: string;
  label: string;
  group?: string;
}

function ComboSelect({
  items,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches",
  className,
}: {
  items: ComboItem[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const labelOf = useMemo(() => {
    const map = new Map(items.map((i) => [i.id, i.label]));
    return (id: string | null) => (id ? (map.get(id) ?? id) : "");
  }, [items]);

  return (
    <Combobox.Root
      items={ids}
      value={value}
      onValueChange={onChange}
      itemToStringLabel={(id) => labelOf(id)}
    >
      <Combobox.Trigger
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900",
          "border-0 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
          "cursor-default select-none",
          className,
        )}
      >
        <Combobox.Value>
          {(selected: string | null) =>
            selected ? (
              <span className="truncate">{labelOf(selected)}</span>
            ) : (
              <span className="text-gray-400">{placeholder}</span>
            )
          }
        </Combobox.Value>
        <span className="text-gray-400">▾</span>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner align="start" sideOffset={4} className="z-50">
          <Combobox.Popup className="z-50 max-h-72 w-[var(--anchor-width)] overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
            <div className="p-1">
              <Combobox.Input
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-md bg-[#F6F6F6] px-2 text-sm outline-none"
              />
            </div>
            <Combobox.Empty className="px-3 py-2 text-sm text-gray-400">
              {emptyText}
            </Combobox.Empty>
            <Combobox.List>
              {(id: string) => {
                const item = items.find((i) => i.id === id);
                return (
                  <Combobox.Item
                    key={id}
                    value={id}
                    className="flex cursor-default items-center justify-between rounded-md px-3 py-2 text-sm text-gray-700 data-[highlighted]:bg-[#F6F6F6] data-[highlighted]:text-gray-900"
                  >
                    <span className="truncate">{item?.label ?? id}</span>
                    {item?.group && (
                      <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wide text-gray-400">
                        {item.group}
                      </span>
                    )}
                  </Combobox.Item>
                );
              }}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

export default function ProjectTasks() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const { data: board, isLoading } = useTaskBoard(project.id);
  const { data: assignable = [] } = useAssignableUsers(project.id);

  const createTask = useCreateTask(project.id);
  const updateTask = useUpdateTask(project.id);
  const moveTask = useMoveTask(project.id);
  const deleteTask = useDeleteTask(project.id);
  const addColumn = useAddColumn(project.id);
  const renameColumn = useRenameColumn(project.id);
  const deleteColumn = useDeleteColumn(project.id);
  const reorderColumns = useReorderColumns(project.id);

  const [searchParams, setSearchParams] = useSearchParams();
  const focusedTaskId = searchParams.get("task");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [createColumnId, setCreateColumnId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  useEffect(() => {
    if (!focusedTaskId || !board) return;
    const target = board.tasks.find((t) => t.id === focusedTaskId);
    if (target) {
      setEditing(target);
      setCreateColumnId(null);
      setDialogOpen(true);
    }
  }, [focusedTaskId, board]);

  function setFocusedTask(taskId: string | null): void {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (taskId) next.set("task", taskId);
        else next.delete("task");
        return next;
      },
      { replace: true },
    );
  }

  const userOptions: AssigneeOption[] = useMemo(
    () =>
      assignable
        .filter((a) => a.kind === "user")
        .map((a) => ({ kind: "user" as const, id: a.id, name: a.isSelf ? `${a.name} (me)` : a.name })),
    [assignable],
  );
  const teamOptions: AssigneeOption[] = useMemo(
    () =>
      assignable
        .filter((a) => a.kind === "team")
        .map((a) => ({ kind: "team" as const, id: a.id, name: a.name })),
    [assignable],
  );
  const selfId = useMemo(() => assignable.find((a) => a.isSelf)?.id ?? null, [assignable]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  if (isLoading || !board) {
    return (
      <div className="flex flex-1 items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    );
  }

  const tasksByColumn = new Map<string, Task[]>();
  for (const column of board.columns) tasksByColumn.set(column.id, []);
  for (const task of board.tasks) {
    const list = tasksByColumn.get(task.columnId);
    if (list) list.push(task);
  }
  for (const list of tasksByColumn.values()) list.sort((a, b) => a.position - b.position);

  function openCreate(columnId: string): void {
    setEditing(null);
    setCreateColumnId(columnId);
    setDialogOpen(true);
  }

  function openEdit(task: Task): void {
    setEditing(task);
    setCreateColumnId(null);
    setDialogOpen(true);
    setFocusedTask(task.id);
  }

  function handleDialogOpenChange(open: boolean): void {
    setDialogOpen(open);
    if (!open) setFocusedTask(null);
  }

  function handleAddColumn(): void {
    const name = newColumnName.trim();
    if (!name) return;
    addColumn.mutate(name, {
      onSuccess: () => {
        setNewColumnName("");
        setAddingColumn(false);
      },
      onError: () => toast("Could not add column"),
    });
  }

  function handleRenameColumn(columnId: string, name: string): void {
    renameColumn.mutate({ columnId, name }, { onError: () => toast("Could not rename column") });
  }

  function handleDeleteColumn(columnId: string): void {
    deleteColumn.mutate(columnId, {
      onError: (err) => {
        const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast(message ?? "Could not delete column");
      },
    });
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over) return;

    if (active.data.current?.type === "column") {
      if (active.id === over.id) return;
      const ids = board!.columns.map((c) => c.id);
      const from = ids.indexOf(String(active.id));
      const to = ids.indexOf(String(over.id));
      if (from === -1 || to === -1) return;
      const next = [...ids];
      next.splice(to, 0, next.splice(from, 1)[0]!);
      reorderColumns.mutate(next);
      return;
    }

    const taskId = String(active.id);
    const targetColumnId = String(over.id);
    const task = board!.tasks.find((t) => t.id === taskId);
    if (!task || task.columnId === targetColumnId) return;

    const targetTasks = tasksByColumn.get(targetColumnId) ?? [];
    const lastPosition = targetTasks.length
      ? targetTasks[targetTasks.length - 1]!.position
      : 0;
    moveTask.mutate({ taskId, columnId: targetColumnId, position: lastPosition + 1000 });
  }

  function handleSubmit(values: {
    title: string;
    description: string;
    descriptionHtml: string;
    assignee: AssigneeOption | null;
    dueDate: string | null;
    priority: TaskPriority;
    labels: string[];
  }): void {
    const assigneeFields = {
      assigneeId: values.assignee?.kind === "user" ? values.assignee.id : null,
      assigneeTeamMemberId: values.assignee?.kind === "team" ? values.assignee.id : null,
    };
    if (editing) {
      updateTask.mutate(
        {
          taskId: editing.id,
          input: {
            title: values.title,
            description: values.description,
            descriptionHtml: values.descriptionHtml,
            dueDate: values.dueDate,
            priority: values.priority,
            labels: values.labels,
            ...assigneeFields,
          },
        },
        {
          onSuccess: () => setDialogOpen(false),
          onError: () => toast("Could not update task"),
        },
      );
    } else {
      createTask.mutate(
        {
          title: values.title,
          description: values.description,
          descriptionHtml: values.descriptionHtml,
          dueDate: values.dueDate,
          priority: values.priority,
          labels: values.labels,
          columnId: createColumnId,
          ...assigneeFields,
        },
        {
          onSuccess: () => setDialogOpen(false),
          onError: () => toast("Could not create task"),
        },
      );
    }
  }

  return (
    <div className="w-full px-6 py-8 sm:px-10">
      <PageHeader
        title="Tasks"
        description="Plan and track work across the team. Drag cards between columns."
        actions={
          canManage && board.columns[0] ? (
            <Button variant="primary" size="md" onClick={() => openCreate(board.columns[0]!.id)}>
              <PlusIcon className="size-4" />
              New task
            </Button>
          ) : null
        }
      />

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="mt-6 flex items-start gap-4 overflow-x-auto pb-4">
          <SortableContext
            items={board.columns.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            {board.columns.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                tasks={tasksByColumn.get(column.id) ?? []}
                canManage={canManage}
                onAddCard={() => openCreate(column.id)}
                onOpenTask={openEdit}
                onRename={(name) => handleRenameColumn(column.id, name)}
                onDelete={() => handleDeleteColumn(column.id)}
              />
            ))}
          </SortableContext>

          {canManage && (
            <div className="w-72 shrink-0">
              {addingColumn ? (
                <div className="flex flex-col gap-2 rounded-2xl bg-[#FAFAFA] p-3">
                  <input
                    autoFocus
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddColumn();
                      if (e.key === "Escape") { setAddingColumn(false); setNewColumnName(""); }
                    }}
                    placeholder="Column name"
                    className={FIELD}
                  />
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={handleAddColumn} disabled={!newColumnName.trim()}>
                      Add
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setAddingColumn(false); setNewColumnName(""); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingColumn(true)}
                  className="flex w-full items-center gap-1.5 rounded-2xl border border-dashed border-gray-300 px-3 py-3 text-sm font-medium text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-gray-900"
                >
                  <PlusIcon className="size-4" />
                  Add column
                </button>
              )}
            </div>
          )}
        </div>
      </DndContext>

      <UpsertTaskDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        projectId={project.id}
        task={editing}
        allTasks={board.tasks}
        userOptions={userOptions}
        teamOptions={teamOptions}
        selfId={selfId}
        submitting={createTask.isPending || updateTask.isPending}
        onSubmit={handleSubmit}
        onRequestDelete={editing ? () => { setDeleting(editing); setDialogOpen(false); } : undefined}
        onOpenTask={(taskId) => {
          const target = board.tasks.find((t) => t.id === taskId);
          if (target) openEdit(target);
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        onConfirm={() => {
          if (deleting) {
            deleteTask.mutate(deleting.id, { onError: () => toast("Could not delete task") });
          }
        }}
        title="Delete task"
        description={deleting ? `Delete "${deleting.title}"? This cannot be undone.` : ""}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

function BoardColumn({
  column,
  tasks,
  canManage,
  onAddCard,
  onOpenTask,
  onRename,
  onDelete,
}: {
  column: TaskColumn;
  tasks: Task[];
  canManage: boolean;
  onAddCard: () => void;
  onOpenTask: (task: Task) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isOver,
    isDragging,
  } = useSortable({
    id: column.id,
    data: { type: "column" },
    disabled: !canManage,
  });
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(column.name);

  function commitRename(): void {
    const trimmed = name.trim();
    setRenaming(false);
    if (trimmed && trimmed !== column.name) onRename(trimmed);
    else setName(column.name);
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex w-72 shrink-0 flex-col gap-3 rounded-2xl bg-[#FAFAFA] p-3 transition-colors",
        isOver && "bg-[#EEF2FF] ring-2 ring-[#C7D7FF]",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {canManage && (
            <button
              type="button"
              aria-label={`Reorder ${column.name} column`}
              className="flex size-6 shrink-0 cursor-grab items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="6" r="1.6" />
                <circle cx="15" cy="6" r="1.6" />
                <circle cx="9" cy="12" r="1.6" />
                <circle cx="15" cy="12" r="1.6" />
                <circle cx="9" cy="18" r="1.6" />
                <circle cx="15" cy="18" r="1.6" />
              </svg>
            </button>
          )}
          {renaming ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") { setName(column.name); setRenaming(false); }
              }}
              className="h-7 min-w-0 flex-1 rounded-md bg-white px-2 text-sm font-semibold text-gray-900 outline-none ring-1 ring-gray-300"
            />
          ) : (
            <button
              type="button"
              onClick={() => canManage && setRenaming(true)}
              className={cn("truncate text-left text-sm font-semibold text-gray-900", canManage && "hover:text-[#004DE7]")}
              title={canManage ? "Rename column" : undefined}
            >
              {column.name}
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-200 px-1.5 text-xs font-medium text-gray-600">
            {tasks.length}
          </span>
          {canManage && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${column.name} column`}
              className="flex size-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} canManage={canManage} onOpen={() => onOpenTask(task)} />
        ))}
        {tasks.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400">
            No tasks
          </div>
        )}
      </div>

      {canManage && (
        <button
          type="button"
          onClick={onAddCard}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <PlusIcon className="size-3.5" />
          Add task
        </button>
      )}
    </div>
  );
}

function TaskCard({
  task,
  canManage,
  onOpen,
}: {
  task: Task;
  canManage: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !canManage,
  });
  const due = formatDayMonth(task.dueDate) || null;
  const coverFileId = firstImageFileId(task.descriptionHtml);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!coverFileId) {
      setCoverUrl(null);
      return;
    }
    let cancelled = false;
    void resolveFileUrl(coverFileId)
      .then((url) => {
        if (!cancelled) setCoverUrl(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [coverFileId]);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow",
        isDragging ? "opacity-50 shadow-md" : "hover:shadow-md",
        canManage && "cursor-grab active:cursor-grabbing",
      )}
      {...(canManage ? listeners : {})}
      {...attributes}
    >
      {coverUrl && (
        <img
          src={coverUrl}
          alt=""
          className="h-28 w-full object-cover"
          draggable={false}
        />
      )}
      <div className="p-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <PriorityBadge priority={task.priority} />
        </div>
        <button type="button" onClick={onOpen} className="block w-full text-left outline-none">
          <p className="text-sm font-medium text-gray-900">{task.title}</p>
          {task.description && htmlToText(task.description) && (
            <p className="mt-1 line-clamp-2 text-xs text-gray-500">{htmlToText(task.description)}</p>
          )}
        </button>
        {task.labels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {task.labels.slice(0, 3).map((label) => (
              <span
                key={label}
                className="inline-flex max-w-[140px] items-center truncate rounded-full bg-[#F6F6F6] px-2 py-0.5 text-[11px] font-medium text-gray-600"
              >
                {label}
              </span>
            ))}
            {task.labels.length > 3 && (
              <span className="inline-flex items-center rounded-full bg-[#F6F6F6] px-2 py-0.5 text-[11px] font-medium text-gray-400">
                +{task.labels.length - 3}
              </span>
            )}
          </div>
        )}
        {(task.assigneeName || due || task.subtaskTotal > 0) && (
          <div className="mt-2.5 flex items-center justify-between">
            {task.assigneeName ? (
              <div className="flex items-center gap-1.5">
                <Avatar name={task.assigneeName} size="sm" />
                <span className="text-xs text-gray-600">{task.assigneeName}</span>
              </div>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              {task.subtaskTotal > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#F6F6F6] px-2 py-0.5 text-[11px] font-medium text-gray-500">
                  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  {task.subtaskDone}/{task.subtaskTotal}
                </span>
              )}
              {due && (
                <span className="rounded-full bg-[#F6F6F6] px-2 py-0.5 text-[11px] font-medium text-gray-500">
                  {due}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UpsertTaskDialog({
  open,
  onOpenChange,
  projectId,
  task,
  allTasks,
  userOptions,
  teamOptions,
  selfId,
  submitting,
  onSubmit,
  onRequestDelete,
  onOpenTask,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  task: Task | null;
  allTasks: Task[];
  userOptions: AssigneeOption[];
  teamOptions: AssigneeOption[];
  selfId: string | null;
  submitting: boolean;
  onSubmit: (values: { title: string; description: string; descriptionHtml: string; assignee: AssigneeOption | null; dueDate: string | null; priority: TaskPriority; labels: string[] }) => void;
  onRequestDelete?: () => void;
  onOpenTask?: (taskId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [assigneeValue, setAssigneeValue] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [labels, setLabels] = useState<string[]>([]);
  const [labelDraft, setLabelDraft] = useState<string>("");

  const dialogKey = task?.id ?? "new";

  const assigneeItems = useMemo<ComboItem[]>(
    () => [
      ...userOptions.map((o) => ({ id: `user:${o.id}`, label: o.name, group: "Person" })),
      ...teamOptions.map((o) => ({ id: `team:${o.id}`, label: o.name, group: "Team" })),
    ],
    [userOptions, teamOptions],
  );

  const [linkCopied, setLinkCopied] = useState(false);

  function copyTaskLink(): void {
    if (!task) return;
    const url = `${window.location.origin}${window.location.pathname}?task=${task.id}`;
    void navigator.clipboard
      .writeText(url)
      .then(() => {
        setLinkCopied(true);
        window.setTimeout(() => setLinkCopied(false), 1500);
      })
      .catch(() => toast("Could not copy link"));
  }

  useMemo(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setDescriptionHtml(task?.descriptionHtml ?? task?.description ?? "");
      setAssigneeValue(
        task?.assigneeId
          ? `user:${task.assigneeId}`
          : task?.assigneeTeamMemberId
            ? `team:${task.assigneeTeamMemberId}`
            : "",
      );
      setDueDate(task?.dueDate ? task.dueDate.slice(0, 10) : "");
      setPriority(task?.priority ?? "Medium");
      setLabels(task?.labels ?? []);
      setLabelDraft("");
    }
  }, [open, dialogKey]);

  function addLabel(raw: string): void {
    const label = raw.trim().slice(0, 40);
    if (!label) return;
    setLabels((prev) =>
      prev.some((l) => l.toLowerCase() === label.toLowerCase()) || prev.length >= 20
        ? prev
        : [...prev, label],
    );
    setLabelDraft("");
  }

  function removeLabel(label: string): void {
    setLabels((prev) => prev.filter((l) => l !== label));
  }

  function resolveAssignee(): AssigneeOption | null {
    if (!assigneeValue) return null;
    const [kind, id] = assigneeValue.split(":");
    const pool = kind === "team" ? teamOptions : userOptions;
    const found = pool.find((o) => o.id === id);
    return found ?? null;
  }

  function handleSubmit(): void {
    if (!title.trim()) return;
    const html = descriptionHtml.trim();
    const isEmpty = html === "" || html === "<p></p>";
    const draft = labelDraft.trim().slice(0, 40);
    const finalLabels =
      draft && !labels.some((l) => l.toLowerCase() === draft.toLowerCase()) && labels.length < 20
        ? [...labels, draft]
        : labels;
    onSubmit({
      title: title.trim(),
      description: isEmpty ? "" : description.trim(),
      descriptionHtml: isEmpty ? "" : html,
      assignee: resolveAssignee(),
      dueDate: dueDate || null,
      priority,
      labels: finalLabels,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={task ? "Edit task" : "New task"}
      submitLabel={task ? "Save" : "Create task"}
      submitDisabled={!title.trim()}
      submitting={submitting}
      onSubmit={handleSubmit}
    >
      {task && (
        <button
          type="button"
          onClick={copyTaskLink}
          className="-mt-1 flex items-center gap-1.5 self-start rounded-lg bg-[#F6F6F6] px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
        >
          <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.07 0l1.93-1.93a5 5 0 0 0-7.07-7.07L10.5 5.5" />
            <path d="M14 11a5 5 0 0 0-7.07 0L5 12.93a5 5 0 0 0 7.07 7.07L13.5 18.5" />
          </svg>
          {linkCopied ? "Link copied" : "Copy task link"}
        </button>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-title">Title</Label>
        <input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Inspect scaffolding"
          className={FIELD}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-desc">Description (optional)</Label>
        <RichTextEditor
          value={descriptionHtml}
          onChange={(html, text) => {
            setDescriptionHtml(html);
            setDescription(text);
          }}
          projectId={projectId}
          placeholder="Add details, checklists, images…"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="task-assignee">Assignee</Label>
          {selfId && assigneeValue !== `user:${selfId}` && (
            <button
              type="button"
              onClick={() => setAssigneeValue(`user:${selfId}`)}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              Assign to me
            </button>
          )}
        </div>
        <ComboSelect
          items={assigneeItems}
          value={assigneeValue || null}
          onChange={(v) => setAssigneeValue(v ?? "")}
          placeholder="Unassigned"
          searchPlaceholder="Search people or team…"
          emptyText="No people found"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-due">Due date (optional)</Label>
        <input
          id="task-due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={FIELD}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Priority</Label>
        <div className="flex gap-2">
          {PRIORITY_ORDER.map((p) => {
            const meta = PRIORITY_META[p];
            const selected = priority === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                aria-pressed={selected}
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
              >
                <Badge tone={meta.tone} variant={selected ? "solid" : "soft"} size="md">
                  <PriorityIcon shape={meta.shape} />
                  {p}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-labels">Labels (optional)</Label>
        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {labels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full bg-[#F6F6F6] py-0.5 pl-2.5 pr-1 text-xs font-medium text-gray-700"
              >
                {label}
                <button
                  type="button"
                  onClick={() => removeLabel(label)}
                  aria-label={`Remove label ${label}`}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                >
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          id="task-labels"
          type="text"
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addLabel(labelDraft);
            } else if (e.key === "Backspace" && labelDraft === "" && labels.length > 0) {
              const last = labels[labels.length - 1];
              if (last) removeLabel(last);
            }
          }}
          onBlur={() => addLabel(labelDraft)}
          placeholder="Add a label, press Enter"
          maxLength={40}
          className={FIELD}
        />
      </div>
      {task && (task.createdByName || task.createdAt) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          {task.createdByName && (
            <span>
              Reporter <span className="font-medium text-gray-700">{task.createdByName}</span>
            </span>
          )}
          {task.createdAt && (
            <span>
              Created{" "}
              <span className="font-medium text-gray-700">
                {new Date(task.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              </span>
            </span>
          )}
        </div>
      )}
      {task && (
        <TaskExtras projectId={projectId} taskId={task.id} allTasks={allTasks} onOpenTask={onOpenTask} />
      )}
      {onRequestDelete && (
        <button
          type="button"
          onClick={onRequestDelete}
          className="mt-1 self-start text-sm font-medium text-red-500 hover:text-red-600"
        >
          Delete task
        </button>
      )}
    </FormDrawer>
  );
}

const LINK_TYPE_LABELS: Record<TaskLinkType, string> = {
  relates_to: "Relates to",
  blocks: "Blocks",
  blocked_by: "Blocked by",
  duplicates: "Duplicates",
};

const LINK_TYPE_ORDER: TaskLinkType[] = ["blocks", "blocked_by", "relates_to", "duplicates"];

const LINK_TYPE_TONE: Record<TaskLinkType, string> = {
  blocks: "bg-[#FEE2E2] text-[#B42318]",
  blocked_by: "bg-[#FEF0C7] text-[#B54708]",
  relates_to: "bg-[#EEF2FF] text-[#004DE7]",
  duplicates: "bg-[#F2F4F7] text-[#475467]",
};

function TaskExtras({
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
    </>
  );
}
