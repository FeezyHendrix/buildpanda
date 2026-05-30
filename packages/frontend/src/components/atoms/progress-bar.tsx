import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ProgressTone = "brand" | "success" | "warning" | "danger" | "neutral";
type ProgressSize = "sm" | "md" | "lg";

interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  tone?: ProgressTone;
  size?: ProgressSize;
  trackClassName?: string;
  fillClassName?: string;
}

const fillStyles: Record<ProgressTone, string> = {
  brand: "bg-[#004DE7]",
  success: "bg-[#1B8E45]",
  warning: "bg-[#C26A00]",
  danger: "bg-[#C72525]",
  neutral: "bg-gray-700",
};

const trackHeight: Record<ProgressSize, string> = {
  sm: "h-1",
  md: "h-1.5",
  lg: "h-2",
};

const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      value,
      max = 100,
      tone = "brand",
      size = "md",
      trackClassName,
      fillClassName,
      className,
      ...props
    },
    ref,
  ) => {
    const clamped = Math.max(0, Math.min(max, value));
    const pct = max === 0 ? 0 : (clamped / max) * 100;

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={max}
        className={cn(
          "w-full overflow-hidden rounded-full bg-[#EDEDED]",
          trackHeight[size],
          trackClassName,
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            fillStyles[tone],
            fillClassName,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  },
);

ProgressBar.displayName = "ProgressBar";

export { ProgressBar, type ProgressBarProps, type ProgressTone };
