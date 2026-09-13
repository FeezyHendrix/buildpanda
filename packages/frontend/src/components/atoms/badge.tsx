import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent";

type BadgeVariant = "soft" | "solid" | "outline";

type BadgeSize = "sm" | "md";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

/**
 * Tones come from the status tokens, so a badge, a table cell and a chart
 * series all say "at risk" in exactly the same amber.
 */
const softStyles: Record<BadgeTone, string> = {
  neutral: "bg-gray-50 text-gray-700",
  success: "bg-success-50 text-success-500",
  warning: "bg-warning-50 text-warning-500",
  danger: "bg-negative-50 text-negative-500",
  info: "bg-primary-50 text-primary-500",
  accent: "bg-accent-50 text-accent-500",
};

const solidStyles: Record<BadgeTone, string> = {
  neutral: "bg-gray-700 text-white",
  success: "bg-success-500 text-white",
  warning: "bg-warning-500 text-white",
  danger: "bg-negative-500 text-white",
  info: "bg-primary-500 text-white",
  accent: "bg-accent-500 text-white",
};

const outlineStyles: Record<BadgeTone, string> = {
  neutral: "border border-gray-300 text-gray-700",
  success: "border border-success-500/40 text-success-500",
  warning: "border border-warning-500/40 text-warning-500",
  danger: "border border-negative-500/40 text-negative-500",
  info: "border border-primary-500/40 text-primary-500",
  accent: "border border-accent-500/40 text-accent-500",
};

const dotStyles: Record<BadgeTone, string> = {
  neutral: "bg-gray-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-negative-500",
  info: "bg-primary-500",
  accent: "bg-accent-500",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "h-5 gap-1 rounded-full px-2 text-[11px]",
  md: "h-6 gap-1.5 rounded-full px-2.5 text-xs",
};

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      tone = "neutral",
      variant = "soft",
      size = "sm",
      dot = false,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const variantClass =
      variant === "solid"
        ? solidStyles[tone]
        : variant === "outline"
          ? outlineStyles[tone]
          : softStyles[tone];

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center font-medium leading-none whitespace-nowrap",
          sizeStyles[size],
          variantClass,
          className,
        )}
        {...props}
      >
        {dot && (
          <span
            aria-hidden="true"
            className={cn("size-1.5 shrink-0 rounded-full", dotStyles[tone])}
          />
        )}
        {children}
      </span>
    );
  },
);

Badge.displayName = "Badge";

export {
  Badge,
  type BadgeProps,
  type BadgeTone,
  type BadgeVariant,
  type BadgeSize,
};
