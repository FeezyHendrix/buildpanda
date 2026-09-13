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
        "flex items-center gap-4 rounded-xl p-6 text-left",
        "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
        "transition-colors",
        selected
          ? "border-2 border-[#004DE7] bg-[#F0F4FF]"
          : "border-2 border-[#F6F6F6] bg-white hover:border-gray-300",
        disabled && "cursor-not-allowed opacity-70",
        className,
      )}
    >
      <div
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          selected
            ? "border-[#004DE7] bg-[#004DE7]"
            : "border-gray-300 bg-white",
        )}
      >
        {selected && <div className="size-2 rounded-full bg-white" />}
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <p className="text-sm text-gray-500 text-pretty">{description}</p>
      </div>
    </button>
  );
}

RadioCard.displayName = "RadioCard";

export { RadioCard, type RadioCardProps };
