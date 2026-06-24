import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { cn } from "@/lib/utils";
import type { Task, TaskColumn } from "@/lib/project-types";
import { TaskCard } from "./task-card";

export function BoardColumn({
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

BoardColumn.displayName = "BoardColumn";
