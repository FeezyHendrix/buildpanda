import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RadioCardProps {
  title: ReactNode;
  description: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

function RadioCard({
  title,
  description,
  selected = false,
  disabled = false,
  onClick,
  className,
}: RadioCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 rounded-lg p-6 text-left",
        "outline-none focus-visible:shadow-focus",
        "transition-colors",
        selected
          ? "border-2 border-primary-500 bg-primary-50"
          : "border-2 border-line-hair bg-white hover:border-gray-300",
        disabled && "cursor-not-allowed opacity-70",
        className,
      )}
    >
      <div
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          selected
            ? "border-primary-500 bg-primary-500"
            : "border-gray-300 bg-white",
        )}
      >
        {selected && <div className="size-2 rounded-full bg-white" />}
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink">{title}</span>
        <p className="text-sm text-ink-muted text-pretty">{description}</p>
      </div>
    </button>
  );
}

RadioCard.displayName = "RadioCard";

export { RadioCard, type RadioCardProps };
