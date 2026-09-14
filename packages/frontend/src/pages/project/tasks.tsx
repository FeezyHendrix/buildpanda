import { TaskBoardHeader, type TaskBoardScope } from "./tasks/task-board-header";
import { QueryError } from "@/components/molecules/query-error";
import { useMemo, useState } from "react";
import { useTaskDestination } from "./tasks/use-task-destination";
import { useUrlState } from "@/hooks/use-url-state";
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
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { useProjectContext } from "@/layouts/project-layout";
import { useBuildingScope } from "@/contexts/building-scope-context";
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
import { canResourceAction, type Task, type TaskPriority } from "@/lib/project-types";
import { type AssigneeOption, FIELD } from "./tasks/task-ui";
import { BoardColumn } from "./tasks/task-board-column";
import { UpsertTaskDialog } from "./tasks/upsert-task-dialog";

export default function ProjectTasks() {
  const { project, access } = useProjectContext();
  const { selectedBuildingId } = useBuildingScope();
  const canAddTasks = Boolean(access && canResourceAction(access, "tasks", "add"));
  const canRemoveTasks = Boolean(access && canResourceAction(access, "tasks", "remove"));
  const canManage = canAddTasks;
  const canSeeAllTasks = canRemoveTasks;
  const [boardScope, setBoardScope] = useUrlState<TaskBoardScope>("scope", "all", ["all", "assigned"]);
  const requestedScope: TaskBoardScope = canSeeAllTasks ? boardScope : "assigned";
  const { data: board, isLoading, error, refetch } = useTaskBoard(project.id, requestedScope, Boolean(access), selectedBuildingId);
  const { data: assignable = [] } = useAssignableUsers(project.id);

  const createTask = useCreateTask(project.id);
  const updateTask = useUpdateTask(project.id);
  const moveTask = useMoveTask(project.id);
  const deleteTask = useDeleteTask(project.id);
  const addColumn = useAddColumn(project.id);
  const renameColumn = useRenameColumn(project.id);
  const deleteColumn = useDeleteColumn(project.id);
  const reorderColumns = useReorderColumns(project.id);

  const destination = useTaskDestination(project.id);
  const editing = destination.task;
  const dialogOpen = destination.creating || Boolean(editing);

  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

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

  if (error && !board) return <QueryError error={error} retry={refetch} noun="tasks" />;
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
    destination.open("new", columnId);
  }

  function openEdit(task: Task): void {
    destination.open(task.id);
  }

  function handleDialogOpenChange(open: boolean): void {
    if (!open) destination.close();
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

  /** Same move the drag performs, reachable from the card's menu and the keyboard. */
  function moveTaskToColumn(task: Task, targetColumnId: string): void {
    if (task.columnId === targetColumnId) return;
    const targetTasks = tasksByColumn.get(targetColumnId) ?? [];
    const lastPosition = targetTasks.length ? targetTasks[targetTasks.length - 1]!.position : 0;
    moveTask.mutate({ taskId: task.id, columnId: targetColumnId, position: lastPosition + 1000 });
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

  async function handleSubmit(values: {
    title: string;
    description: string;
    descriptionHtml: string;
    assignees: AssigneeOption[];
    dueDate: string | null;
    priority: TaskPriority;
    labels: string[];
  }): Promise<void> {
    const input = { ...values, assignees: values.assignees.map(({ kind, id }) => ({ kind, id })) };
    if (editing) await updateTask.mutateAsync({ taskId: editing.id, input });
    else await createTask.mutateAsync({ ...input, columnId: destination.columnId });
  }

  return (
    <div className="w-full px-4 lg:px-6 pt-4 pb-8 sm:px-10">
      <TaskBoardHeader
        onCreate={canAddTasks && board.columns[0] ? () => openCreate(board.columns[0]!.id) : undefined}
        scope={requestedScope}
        onScopeChange={canSeeAllTasks ? setBoardScope : undefined}
      />

      {destination.pending ? <Spinner size="sm" /> : null}
      {destination.error ? (
        <div className="my-4">
          <QueryError error={destination.error} retry={destination.retry} noun="task" />
          <Button variant="secondary" onClick={destination.close}>Return to task board</Button>
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
                columns={board.columns}
                tasks={tasksByColumn.get(column.id) ?? []}
                canManage={canManage}
                canAddCard={canAddTasks}
                onAddCard={() => openCreate(column.id)}
                onOpenTask={openEdit}
                onMoveTask={moveTaskToColumn}
                onRename={(name) => handleRenameColumn(column.id, name)}
                onDelete={() => handleDeleteColumn(column.id)}
              />
            ))}
          </SortableContext>

          {canManage && (
            <div className="w-[85vw] shrink-0 snap-start sm:w-72">
              {addingColumn ? (
                <div className="flex flex-col gap-2 rounded-lg bg-surface-alt p-3">
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
                  className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-3 text-sm font-medium text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-gray-900"
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
        onSubmit={handleSubmit}
        onDelete={editing && canRemoveTasks ? async () => { await deleteTask.mutateAsync(editing.id); } : undefined}
        onOpenTask={destination.open}
      />
    </div>
  );
}
