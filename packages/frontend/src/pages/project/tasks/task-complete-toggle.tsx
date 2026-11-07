import type { PointerEvent as ReactPointerEvent } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskCompleteToggleProps {
  done: boolean;
  taskTitle: string;
  variant?: "icon" | "labelled";
  onToggle: () => void;
}

export function TaskCompleteToggle({
  done,
  taskTitle,
  variant = "icon",
  onToggle,
}: TaskCompleteToggleProps) {
  const label = done
    ? `Reopen "${taskTitle}"`
    : `Mark "${taskTitle}" complete`;

  // The card is a drag source, so a pointerdown on this control must not also
  // start a dnd-kit drag.
  function swallowDragStart(event: ReactPointerEvent): void {
    event.stopPropagation();
  }

  if (variant === "labelled") {
    return (
      <button
        type="button"
        aria-pressed={done}
        aria-label={label}
        onPointerDown={swallowDragStart}
        onClick={onToggle}
        className={cn(
          "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-caption-m font-semibold transition-colors outline-none focus-visible:shadow-focus",
          done
            ? "border-success-100 bg-[#F0FDF4] text-[#008236] hover:bg-[#DCFCE7]"
            : "border-border bg-black-50 text-grey-450 hover:text-black-500",
        )}
      >
        <Check className="size-3.5 shrink-0" strokeWidth={3} />
        {done ? "Completed" : "Mark complete"}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={done}
      aria-label={label}
      title={label}
      onPointerDown={swallowDragStart}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors outline-none focus-visible:shadow-focus",
        done
          ? "border-[#008236] bg-[#008236] text-white"
          : "border-gray-300 bg-white text-transparent hover:border-[#008236] hover:text-gray-300",
      )}
    >
      <Check className="size-3" strokeWidth={3.5} />
    </button>
  );
}

TaskCompleteToggle.displayName = "TaskCompleteToggle";
export type { TaskCompleteToggleProps };
