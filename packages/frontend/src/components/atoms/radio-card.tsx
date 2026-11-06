import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type RadioCardVariant = "default" | "square";

interface RadioCardProps {
  title: ReactNode;
  description: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  /** `square` is the flat, hairline-bordered card used on the settings tabs. */
  variant?: RadioCardVariant;
}

const CARD_STYLES: Record<RadioCardVariant, { base: string; selected: string; idle: string }> = {
  default: {
    base: "gap-4 rounded-xl border-2 p-6",
    selected: "border-[#004DE7] bg-[#F0F4FF]",
    idle: "border-[#F6F6F6] bg-white hover:border-gray-300",
  },
  square: {
    base: "gap-[16px] rounded-none border px-[23px] py-[24px]",
    selected: "border-[#004DE7] bg-[#F0F4FF]",
    idle: "border-[#EEEEEE] bg-white hover:border-gray-300",
  },
};

const INDICATOR_STYLES: Record<RadioCardVariant, { base: string; idle: string }> = {
  default: { base: "size-5", idle: "border-gray-300" },
  square: { base: "size-[24px]", idle: "border-[#737373]" },
};

function RadioCard({
  title,
  description,
  selected = false,
  disabled = false,
  onClick,
  className,
  variant = "default",
}: RadioCardProps) {
  const card = CARD_STYLES[variant];
  const indicator = INDICATOR_STYLES[variant];
  const square = variant === "square";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center text-left",
        "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
        "transition-colors",
        card.base,
        selected ? card.selected : card.idle,
        disabled && "cursor-not-allowed opacity-70",
        className,
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border-2",
          indicator.base,
          selected ? "border-[#004DE7] bg-[#004DE7]" : cn("bg-white", indicator.idle),
        )}
      >
        {selected && <div className={cn("rounded-full bg-white", square ? "size-[10px]" : "size-2")} />}
      </div>

      <div className={cn("flex flex-1 flex-col", square ? "gap-[6px]" : "gap-1.5")}>
        <span
          className={cn(
            square ? "text-[16px] leading-[24px] font-medium text-[#1E1E1E]" : "text-sm font-semibold text-gray-900",
          )}
        >
          {title}
        </span>
        <p className={cn("text-pretty", square ? "text-[14px] leading-[20px] text-[#737373]" : "text-sm text-gray-500")}>
          {description}
        </p>
      </div>
    </button>
  );
}

RadioCard.displayName = "RadioCard";

export { RadioCard, type RadioCardProps, type RadioCardVariant };
