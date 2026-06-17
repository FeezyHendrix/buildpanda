import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
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
import { useParticipants } from "@/hooks/use-participants";
import { useProjectTeam } from "@/hooks/use-team";
import {
  useTaskBoard,
  useCreateTask,
  useUpdateTask,
  useMoveTask,
  useDeleteTask,
  useAddColumn,
  useRenameColumn,
  useDeleteColumn,
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
import type { Task, TaskColumn, TaskLinkType } from "@/lib/project-types";

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

export default function ProjectTasks() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const { data: board, isLoading } = useTaskBoard(project.id);
  const { data: participants = [] } = useParticipants(project.id);
  const { data: teamMembers = [] } = useProjectTeam(project.id);

  const createTask = useCreateTask(project.id);
  const updateTask = useUpdateTask(project.id);
  const moveTask = useMoveTask(project.id);
  const deleteTask = useDeleteTask(project.id);
  const addColumn = useAddColumn(project.id);
  const renameColumn = useRenameColumn(project.id);
  const deleteColumn = useDeleteColumn(project.id);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [createColumnId, setCreateColumnId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  const userOptions: AssigneeOption[] = useMemo(
    () =>
      participants
        .filter((p) => p.userId)
        .map((p) => ({ kind: "user" as const, id: p.userId as string, name: p.name ?? p.email })),
    [participants],
  );
  const teamOptions: AssigneeOption[] = useMemo(
    () => teamMembers.map((m) => ({ kind: "team" as const, id: m.id, name: m.name })),
    [teamMembers],
  );

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
    assignee: AssigneeOption | null;
    dueDate: string | null;
  }): void {
    const assigneeFields = {
      assigneeId: values.assignee?.kind === "user" ? values.assignee.id : null,
      assigneeTeamMemberId: values.assignee?.kind === "team" ? values.assignee.id : null,
    };
    if (editing) {
      updateTask.mutate(
        {
          taskId: editing.id,
          input: { title: values.title, description: values.description, dueDate: values.dueDate, ...assigneeFields },
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
          dueDate: values.dueDate,
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
        onOpenChange={setDialogOpen}
        projectId={project.id}
        task={editing}
        allTasks={board.tasks}
        userOptions={userOptions}
        teamOptions={teamOptions}
        submitting={createTask.isPending || updateTask.isPending}
        onSubmit={handleSubmit}
        onRequestDelete={editing ? () => { setDeleting(editing); setDialogOpen(false); } : undefined}
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
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
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
      className={cn(
        "flex w-72 shrink-0 flex-col gap-3 rounded-2xl bg-[#FAFAFA] p-3 transition-colors",
        isOver && "bg-[#EEF2FF] ring-2 ring-[#C7D7FF]",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-1">
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

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-shadow",
        isDragging ? "opacity-50 shadow-md" : "hover:shadow-md",
        canManage && "cursor-grab active:cursor-grabbing",
      )}
      {...(canManage ? listeners : {})}
      {...attributes}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left outline-none">
        <p className="text-sm font-medium text-gray-900">{task.title}</p>
        {task.description && htmlToText(task.description) && (
          <p className="mt-1 line-clamp-2 text-xs text-gray-500">{htmlToText(task.description)}</p>
        )}
      </button>
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
  submitting,
  onSubmit,
  onRequestDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  task: Task | null;
  allTasks: Task[];
  userOptions: AssigneeOption[];
  teamOptions: AssigneeOption[];
  submitting: boolean;
  onSubmit: (values: { title: string; description: string; assignee: AssigneeOption | null; dueDate: string | null }) => void;
  onRequestDelete?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeValue, setAssigneeValue] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");

  const dialogKey = task?.id ?? "new";

  useMemo(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setAssigneeValue(
        task?.assigneeId
          ? `user:${task.assigneeId}`
          : task?.assigneeTeamMemberId
            ? `team:${task.assigneeTeamMemberId}`
            : "",
      );
      setDueDate(task?.dueDate ? task.dueDate.slice(0, 10) : "");
    }
  }, [open, dialogKey]);

  function resolveAssignee(): AssigneeOption | null {
    if (!assigneeValue) return null;
    const [kind, id] = assigneeValue.split(":");
    const pool = kind === "team" ? teamOptions : userOptions;
    const found = pool.find((o) => o.id === id);
    return found ?? null;
  }

  function handleSubmit(): void {
    if (!title.trim()) return;
    const html = description.trim();
    const isEmpty = html === "" || html === "<p></p>";
    onSubmit({
      title: title.trim(),
      description: isEmpty ? "" : html,
      assignee: resolveAssignee(),
      dueDate: dueDate || null,
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
          value={description}
          onChange={(html) => setDescription(html)}
          placeholder="Add details, checklists, images…"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-assignee">Assignee</Label>
        <select
          id="task-assignee"
          value={assigneeValue}
          onChange={(e) => setAssigneeValue(e.target.value)}
          className={FIELD}
        >
          <option value="">Unassigned</option>
          {userOptions.length > 0 && (
            <optgroup label="People">
              {userOptions.map((o) => (
                <option key={`user:${o.id}`} value={`user:${o.id}`}>
                  {o.name}
                </option>
              ))}
            </optgroup>
          )}
          {teamOptions.length > 0 && (
            <optgroup label="Team members">
              {teamOptions.map((o) => (
                <option key={`team:${o.id}`} value={`team:${o.id}`}>
                  {o.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
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
      {task && (
        <TaskExtras projectId={projectId} taskId={task.id} allTasks={allTasks} />
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

function TaskExtras({
  projectId,
  taskId,
  allTasks,
}: {
  projectId: string;
  taskId: string;
  allTasks: Task[];
}) {
  const { data: detail } = useTaskDetail(projectId, taskId);
  const addSubtask = useAddSubtask(projectId, taskId);
  const updateSubtask = useUpdateSubtask(projectId, taskId);
  const deleteSubtask = useDeleteSubtask(projectId, taskId);
  const addLink = useAddLink(projectId, taskId);
  const deleteLink = useDeleteLink(projectId, taskId);

  const [newSubtask, setNewSubtask] = useState("");
  const [linkTarget, setLinkTarget] = useState("");
  const [linkType, setLinkType] = useState<TaskLinkType>("relates_to");

  const linkableTasks = allTasks.filter((t) => t.id !== taskId);

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
        onSuccess: () => setLinkTarget(""),
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

      <div className="flex flex-col gap-2">
        <Label>Linked tasks</Label>
        <div className="flex flex-col gap-1">
          {detail?.links.map((link) => (
            <div key={link.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-gray-50">
              <span className="rounded bg-[#EEF2FF] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#004DE7]">
                {LINK_TYPE_LABELS[link.linkType]}
              </span>
              <span className="flex-1 truncate text-sm text-gray-700">{link.targetTaskTitle}</span>
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
        {linkableTasks.length > 0 && (
          <div className="flex gap-2">
            <select value={linkType} onChange={(e) => setLinkType(e.target.value as TaskLinkType)} className={cn(FIELD, "h-9 w-32")}>
              {(Object.keys(LINK_TYPE_LABELS) as TaskLinkType[]).map((t) => (
                <option key={t} value={t}>{LINK_TYPE_LABELS[t]}</option>
              ))}
            </select>
            <select value={linkTarget} onChange={(e) => setLinkTarget(e.target.value)} className={cn(FIELD, "h-9 flex-1")}>
              <option value="">Select a task…</option>
              {linkableTasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            <Button variant="ghost" size="sm" onClick={submitLink} disabled={!linkTarget}>
              Link
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
