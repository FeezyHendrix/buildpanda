import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { Task, TaskColumn } from "@/lib/project-types";
import { TaskCard } from "./task-card";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { Button } from "@/components";

// Per-column collapse preference; column ids are stable so they key storage.
function collapseKey(columnId: string): string {
  return `prefs:v1:task-column-collapsed:${columnId}`;
}

function readCollapsedPref(columnId: string): boolean {
  try {
    return localStorage.getItem(collapseKey(columnId)) === "1";
  } catch {
    return false;
  }
}

function writeCollapsedPref(columnId: string, collapsed: boolean) {
  try {
    localStorage.setItem(collapseKey(columnId), collapsed ? "1" : "0");
  } catch {
    // Private mode / quota — the toggle still works for the session.
  }
}

export function BoardColumn({
  column,
  tasks,
  canManage,
  canAddCard,
  onAddCard,
  onOpenTask,
  onRename,
  onDelete,
}: {
  column: TaskColumn;
  tasks: Task[];
  canManage: boolean;
  canAddCard?: boolean;
  onAddCard: () => void;
  onOpenTask: (task: Task) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const showAddCard = canAddCard ?? canManage;
  const {
    setNodeRef,
    // attributes,
    // listeners,
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
  const [collapsed, setCollapsed] = useState(() => readCollapsedPref(column.id));

  function toggleCollapsed(): void {
    setCollapsed((prev) => {
      writeCollapsedPref(column.id, !prev);
      return !prev;
    });
  }

  function commitRename(): void {
    const trimmed = name.trim();
    setRenaming(false);
    if (trimmed && trimmed !== column.name) onRename(trimmed);
    else setName(column.name);
  }

  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        onClick={toggleCollapsed}
        className={cn(
          "flex w-11 shrink-0 cursor-pointer snap-start flex-col items-center gap-2 rounded-2xl bg-[#FAFAFA] px-1 py-3 transition-colors hover:bg-gray-100",
          isOver && "bg-[#EEF2FF] ring-2 ring-[#C7D7FF]",
          isDragging && "opacity-50",
        )}
      >
        <button
          type="button"
          aria-label={`Expand ${column.name} column`}
          aria-expanded={false}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
        >
          <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-200 px-1.5 text-xs font-medium text-gray-600">
          {tasks.length}
        </span>
        <span className="max-h-[45vh] truncate text-sm font-semibold text-gray-700 [writing-mode:vertical-rl]">
          {column.name}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex !w-[316px] shrink-0 snap-start flex-col gap-3 border-[0.3px] border-border bg-black-50 p-3 transition-colors sm:w-72",
        isOver && "bg-[#EEF2FF] ring-2 ring-[#C7D7FF]",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* {canManage && (
            <button
              type="button"
              aria-label={`Reorder ${column.name} column`}
              className="flex size-6 shrink-0 cursor-grab items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white hover:text-gray-600 active:cursor-grabbing"
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
          )} */}
          {renaming ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setName(column.name);
                  setRenaming(false);
                }
              }}
              className="h-7 min-w-0 flex-1 border border-[#EBEBEB] bg-white px-2 text-sm font-semibold text-[#1E1E1E] outline-none focus:border-[#004DE7]"
            />
          ) : (
            <button
              type="button"
              onClick={() => canManage && setRenaming(true)}
              className={cn(
                "truncate text-left text-caption-l font-semibold text-black-500",
                canManage && "hover:text-[#004DE7]",
              )}
              title={canManage ? "Rename column" : undefined}
            >
              {column.name}
            </button>
          )}
          <span className="flex size-6 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-caption-m font-medium text-black-500 border-[0.5px] border-border">
            {tasks.length}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canManage && (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onAddCard}
                aria-label={`Add task to ${column.name}`}
                className="bg-white w-6 h-6 flex items-center justify-center"
              >
                <ReactSVG
                  src={icons2.plus}
                  className="[&_path]:fill-black-500 [&_svg]:size-4"
                />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onDelete}
                aria-label={`Delete ${column.name} column`}
                className=" bg-white w-6 h-6"
              >
                <ReactSVG
                  src={icons2.delete}
                  className="[&_path]:fill-black-500 [&_svg]:size-4"
                />
              </Button>
            </>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={`Collapse ${column.name} column`}
            aria-expanded
            className="flex size-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white hover:text-gray-600"
          >
            <svg
              className="size-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            canManage={canManage}
            onOpen={() => onOpenTask(task)}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex h-[176px] items-center justify-center border-[0.3px] border-dashed border-border py-6 text-center text-caption-m text-grey-450">
            No tasks
          </div>
        )}
      </div>

      {showAddCard && (
        <button
          type="button"
          onClick={onAddCard}
          className="flex items-center gap-1.5 px-1 py-1 text-caption-m font-medium text-grey-450 transition-colors hover:text-black-500 group"
        >
          <ReactSVG
            src={icons2.plus}
            className="[&_path]:fill-grey-450 group-hover:[&_path]:fill-black-500 [&_svg]:size-3.5"
          />
          New Task
        </button>
      )}
    </div>
  );
}

BoardColumn.displayName = "BoardColumn";
