import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface OptionCardProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  selected?: boolean;
  disabled?: boolean;
  badge?: string;
  onClick?: () => void;
  className?: string;
}

function OptionCard({
  icon,
  title,
  subtitle,
  selected = false,
  disabled = false,
  badge,
  onClick,
  className,
}: OptionCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative flex flex-1 flex-col items-start gap-4 rounded-xl p-8 text-left",
        "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
        "transition-colors",
        selected
          ? "border-2 border-[#004DE7] bg-white"
          : "border-2 border-[#F6F6F6] bg-white",
        disabled && "cursor-not-allowed opacity-70",
        className,
      )}
    >
      {badge && (
        <span className="absolute right-4 top-4 rounded-md bg-[#E8FCF4] px-2 py-1 text-xs font-semibold text-[#12A368]">
          {badge}
        </span>
      )}

      <div
        className={cn(
          "flex items-center justify-center",
          selected ? "text-[#004DE7]" : "text-[#C8C8C8]",
        )}
      >
        {icon}
      </div>

      <div className="flex flex-col gap-1.5">
        <span
          className={cn(
            "text-base font-semibold",
            selected ? "text-[#004DE7]" : "text-gray-900",
          )}
        >
          {title}
        </span>
        <span className="text-sm text-gray-500 text-pretty">{subtitle}</span>
      </div>
    </button>
  );
}

OptionCard.displayName = "OptionCard";

export { OptionCard, type OptionCardProps };
