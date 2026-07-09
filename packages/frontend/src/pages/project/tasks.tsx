import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext as BaseSortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";

// Workaround for React 19 type issue with dnd-kit
const SortableContext = BaseSortableContext as any;

import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { PageHeader } from "@/components/molecules/page-header";
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
} from "@/hooks/use-tasks";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { canResourceAction, type Task, type TaskPriority } from "@/lib/project-types";
import { type AssigneeOption, FIELD } from "./tasks/task-ui";
import { BoardColumn } from "./tasks/task-board-column";
import { UpsertTaskDialog } from "./tasks/upsert-task-dialog";

type TaskBoardScope = "assigned" | "all";

export default function ProjectTasks() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const canAddTasks = Boolean(access && canResourceAction(access, "tasks", "add"));
  const canRemoveTasks = Boolean(access && canResourceAction(access, "tasks", "remove"));
  const canSeeAllTasks = canRemoveTasks;
  const [boardScope, setBoardScope] = useState<TaskBoardScope>("all");
  const requestedScope: TaskBoardScope = canSeeAllTasks ? boardScope : "assigned";
  const { data: board, isLoading } = useTaskBoard(project.id, requestedScope, Boolean(access));
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
        .map((a) => ({
          kind: "user" as const,
          id: a.id,
          name: a.isSelf ? `${a.name} (me)` : a.name,
        })),
    [assignable],
  );
  const teamOptions: AssigneeOption[] = useMemo(
    () =>
      assignable
        .filter((a) => a.kind === "team")
        .map((a) => ({ kind: "team" as const, id: a.id, name: a.name })),
    [assignable],
  );
  const selfId = useMemo(
    () => assignable.find((a) => a.isSelf)?.id ?? null,
    [assignable],
  );

  // MouseSensor + TouchSensor (not PointerSensor): on touch devices a
  // long-press starts a drag while a plain swipe keeps scrolling the board.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
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
  const PRIORITY_RANK: Record<TaskPriority, number> = { High: 0, Medium: 1, Low: 2 };
  for (const list of tasksByColumn.values())
    list.sort(
      (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.position - b.position,
    );

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
    renameColumn.mutate(
      { columnId, name },
      { onError: () => toast("Could not rename column") },
    );
  }

  function handleDeleteColumn(columnId: string): void {
    deleteColumn.mutate(columnId, {
      onError: (err) => {
        const message = (err as { response?: { data?: { error?: string } } })
          ?.response?.data?.error;
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
    moveTask.mutate({
      taskId,
      columnId: targetColumnId,
      position: lastPosition + 1000,
    });
  }

  function handleSubmit(values: {
    title: string;
    description: string;
    descriptionHtml: string;
    assignees: AssigneeOption[];
    dueDate: string | null;
    priority: TaskPriority;
    labels: string[];
  }): void {
    const assigneeFields = { assignees: values.assignees.map(({ kind, id }) => ({ kind, id })) };
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
          onSuccess: () => handleDialogOpenChange(false),
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
          onSuccess: () => handleDialogOpenChange(false),
          onError: () => toast("Could not create task"),
        },
      );
    }
  }

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <PageHeader
        title="Tasks"
        description={
          board.scope === "assigned"
            ? "Your personal task board shows only tasks assigned to you. Moving a card updates the shared team board."
            : "Plan and track work across the team. Drag cards between columns."
        }
        actions={
          canAddTasks && board.columns[0] ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => openCreate(board.columns[0]!.id)}
            >
              <PlusIcon className="size-4" />
              New task
            </Button>
          ) : null
        }
      />

      {canSeeAllTasks ? (
        <div className="mt-4 inline-flex rounded-xl bg-[#F6F6F6] p-1">
          <button
            type="button"
            onClick={() => setBoardScope("assigned")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              requestedScope === "assigned" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900",
            )}
          >
            My tasks
          </button>
          <button
            type="button"
            onClick={() => setBoardScope("all")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              requestedScope === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900",
            )}
          >
            All tasks
          </button>
        </div>
      ) : null}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="mt-6 flex snap-x snap-mandatory items-start gap-4 overflow-x-auto scroll-px-4 pb-4 lg:snap-none">
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
                canAddCard={canAddTasks}
                onAddCard={() => openCreate(column.id)}
                onOpenTask={openEdit}
                onRename={(name) => handleRenameColumn(column.id, name)}
                onDelete={() => handleDeleteColumn(column.id)}
              />
            ))}
          </SortableContext>

          {canManage && (
            <div className="w-[85vw] shrink-0 snap-start sm:w-72">
              {addingColumn ? (
                <div className="flex flex-col gap-2 rounded-2xl bg-[#FAFAFA] p-3">
                  <input
                    autoFocus
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddColumn();
                      if (e.key === "Escape") {
                        setAddingColumn(false);
                        setNewColumnName("");
                      }
                    }}
                    placeholder="Column name"
                    className={FIELD}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleAddColumn}
                      disabled={!newColumnName.trim()}
                    >
                      Add
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAddingColumn(false);
                        setNewColumnName("");
                      }}
                    >
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
        onRequestDelete={
          editing && canRemoveTasks
            ? () => {
                setDeleting(editing);
                setDialogOpen(false);
              }
            : undefined
        }
        onOpenTask={(taskId) => {
          const target = board.tasks.find((t) => t.id === taskId);
          if (target) openEdit(target);
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        onConfirm={() => {
          if (deleting) {
            deleteTask.mutate(deleting.id, {
              onError: () => toast("Could not delete task"),
            });
          }
        }}
        title="Delete task"
        description={
          deleting ? `Delete "${deleting.title}"? This cannot be undone.` : ""
        }
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
