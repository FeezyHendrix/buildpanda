import type { PointerEvent as ReactPointerEvent } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function TaskCompleteToggle({
  done,
  taskTitle,
  onToggle,
}: {
  done: boolean;
  taskTitle: string;
  onToggle: () => void;
}) {
  const label = done ? `Reopen "${taskTitle}"` : `Mark "${taskTitle}" complete`;

  // The card is a drag source, so a pointerdown here must not also start a
  // dnd-kit drag — the same guard TaskMoveMenu already needs.
  function swallowDragStart(event: ReactPointerEvent): void {
    event.stopPropagation();
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
          ? "border-success-600 bg-success-600 text-white"
          : "border-gray-300 bg-white text-transparent hover:border-success-600 hover:text-gray-300",
      )}
    >
      <Check className="size-3" strokeWidth={3.5} />
    </button>
  );
}

TaskCompleteToggle.displayName = "TaskCompleteToggle";
