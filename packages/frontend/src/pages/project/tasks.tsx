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

import { Spinner } from "@/components/atoms/spinner";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { useSetPageTitle } from "@/contexts/page-title-context";
import { useProjectContext } from "@/layouts/project-layout";
import { useBuildingScope } from "@/contexts/building-scope-context";
import {
  useTaskBoard,
  useAssignableUsers,
  useCreateTask,
  useUpdateTask,
  useMoveTask,
  useDeleteTask,
  useRenameColumn,
  useDeleteColumn,
  useReorderColumns,
} from "@/hooks/use-tasks";
import { toast } from "@/lib/toast";
import { canResourceAction, type Task, type TaskPriority } from "@/lib/project-types";
import { type AssigneeOption } from "./tasks/task-ui";
import { BoardColumn } from "./tasks/task-board-column";
import { TaskDetailSheet } from "./tasks/task-detail-sheet";
import { UpsertTaskDialog } from "./tasks/upsert-task-dialog";
import { TaskScopeTabs, type TaskBoardScope } from "./tasks/task-scope-tabs";
import { TaskColumnAdder } from "./tasks/task-column-adder";
import { findDoneColumn, findReopenColumn, isDoneColumn } from "./tasks/task-completion";

export default function ProjectTasks() {
  useSetPageTitle(
    "Tasks",
    "Plan and track work across the team. Drag cards between columns.",
  );
  const { project, access } = useProjectContext();
  const { selectedBuildingId } = useBuildingScope();
  const canAddTasks = Boolean(access && canResourceAction(access, "tasks", "add"));
  const canRemoveTasks = Boolean(access && canResourceAction(access, "tasks", "remove"));
  const canManage = canAddTasks;
  const canSeeAllTasks = canRemoveTasks;
  const [boardScope, setBoardScope] = useState<TaskBoardScope>("all");
  const requestedScope: TaskBoardScope = canSeeAllTasks ? boardScope : "assigned";
  const { data: board, isLoading } = useTaskBoard(project.id, requestedScope, Boolean(access), selectedBuildingId);
  const { data: assignable = [] } = useAssignableUsers(project.id);

  const createTask = useCreateTask(project.id);
  const updateTask = useUpdateTask(project.id);
  const moveTask = useMoveTask(project.id);
  const deleteTask = useDeleteTask(project.id);
  const renameColumn = useRenameColumn(project.id);
  const deleteColumn = useDeleteColumn(project.id);
  const reorderColumns = useReorderColumns(project.id);

  const [searchParams, setSearchParams] = useSearchParams();
  const focusedTaskId = searchParams.get("task");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [createColumnId, setCreateColumnId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

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

  const doneColumn = findDoneColumn(board.columns);
  const reopenColumn = findReopenColumn(board.columns);

  function nextPositionIn(columnId: string): number {
    const existing = tasksByColumn.get(columnId) ?? [];
    return (existing.length ? existing[existing.length - 1]!.position : 0) + 1000;
  }

  function handleToggleComplete(task: Task): void {
    const current = board!.columns.find((c) => c.id === task.columnId);
    const target = current && isDoneColumn(current) ? reopenColumn : doneColumn;
    if (!target) {
      toast("This board has no Done column");
      return;
    }
    moveTask.mutate({
      taskId: task.id,
      columnId: target.id,
      position: nextPositionIn(target.id),
    });
  }

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

  function openDetail(task: Task): void {
    setDetailTaskId(task.id);
    setDetailOpen(true);
  }

  const detailTask = detailTaskId ? board?.tasks.find((t) => t.id === detailTaskId) ?? null : null;

  function handleDialogOpenChange(open: boolean): void {
    setDialogOpen(open);
    if (!open) setFocusedTask(null);
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

    moveTask.mutate({
      taskId,
      columnId: targetColumnId,
      position: nextPositionIn(targetColumnId),
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
    <div className="w-full px-4 lg:px-8 py-6">
      {canSeeAllTasks ? (
        <TaskScopeTabs value={requestedScope} onChange={setBoardScope} />
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
                onOpenTask={openDetail}
                onToggleComplete={handleToggleComplete}
                onRename={(name) => handleRenameColumn(column.id, name)}
                onDelete={() => handleDeleteColumn(column.id)}
              />
            ))}
          </SortableContext>

          {canManage && <TaskColumnAdder projectId={project.id} />}
        </div>
      </DndContext>

      <TaskDetailSheet
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailTaskId(null);
        }}
        projectId={project.id}
        taskId={detailTaskId}
        task={detailTask}
        isDone={Boolean(doneColumn && detailTask?.columnId === doneColumn.id)}
        onToggleComplete={canManage ? handleToggleComplete : undefined}
      />

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
