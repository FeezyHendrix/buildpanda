import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** The status vocabulary: success / warning (pending) / danger (negative) / info (other) / neutral / accent. */
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
  /** Leading 6px square dot in the tone colour — the non-colour cue a status pill carries. */
  dot?: boolean;
}

const softStyles: Record<BadgeTone, string> = {
  neutral: "bg-neutral-50 text-neutral-500",
  success: "bg-success-50 text-success-500",
  warning: "bg-warning-50 text-warning-500",
  danger: "bg-negative-50 text-negative-500",
  info: "bg-primary-50 text-primary-600",
  accent: "bg-accent-50 text-accent-500",
};

const solidStyles: Record<BadgeTone, string> = {
  neutral: "bg-neutral-500 text-white",
  success: "bg-success-500 text-white",
  warning: "bg-warning-500 text-white",
  danger: "bg-negative-500 text-white",
  info: "bg-primary-500 text-white",
  accent: "bg-accent-500 text-white",
};

const outlineStyles: Record<BadgeTone, string> = {
  neutral: "border border-line text-neutral-500",
  success: "border border-success-500/40 text-success-500",
  warning: "border border-warning-500/40 text-warning-500",
  danger: "border border-negative-500/40 text-negative-500",
  info: "border border-primary-500/40 text-primary-600",
  accent: "border border-accent-500/40 text-accent-500",
};

/** Ernest's pill: medium = 4px 8px padding on an 8px radius; small = a 2px-radius tag. */
const sizeStyles: Record<BadgeSize, string> = {
  sm: "h-6 gap-1 rounded-md px-2 text-xs",
  md: "h-[30px] min-w-16 gap-1.5 rounded-lg px-2 text-sm",
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
          "inline-flex w-fit max-w-full items-center font-medium whitespace-nowrap",
          sizeStyles[size],
          variantClass,
          className,
        )}
        {...props}
      >
        {dot && (
          <span
            aria-hidden="true"
            className={cn("shrink-0 rounded-[2px] bg-current", size === "md" ? "size-1.5" : "size-1")}
          />
        )}
        <span className="truncate">{children}</span>
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
