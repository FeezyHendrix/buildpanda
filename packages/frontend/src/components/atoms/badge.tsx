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

const softStyles: Record<BadgeTone, string> = {
  neutral: "bg-[#F5F5F5] border border-border text-[#1E1E1E]",
  success: "bg-[#F0FDF4] border border-success-100 text-[#008236]",
  warning: "bg-[#FFFBEB] border border-waring-100 text-[#BB4D00]",
  danger:  "bg-[#FEF2F2] border border-[#FFC9C9]/50 text-[#C10007]",
  info:    "bg-[#E6EDFD] text-[#004DE7]",
  accent:  "bg-[#EDE7FF] text-[#5A3DD0]",
};

const solidStyles: Record<BadgeTone, string> = {
  neutral: "bg-[#1E1E1E] text-white",
  success: "bg-[#008236] text-white",
  warning: "bg-[#BB4D00] text-white",
  danger:  "bg-[#C10007] text-white",
  info:    "bg-[#004DE7] text-white",
  accent:  "bg-[#5A3DD0] text-white",
};

const outlineStyles: Record<BadgeTone, string> = {
  neutral: "border-[0.5px] border-border text-[#1E1E1E]",
  success: "border-[0.5px] border-border text-[#008236]",
  warning: "border-[0.5px] border-border text-[#BB4D00]",
  danger:  "border-[0.5px] border-border text-[#C10007]",
  info:    "border-[0.5px] border-border text-[#004DE7]",
  accent:  "border-[0.5px] border-border text-[#5A3DD0]",
};

const dotStyles: Record<BadgeTone, string> = {
  neutral: "bg-[#1E1E1E]",
  success: "bg-[#008236]",
  warning: "bg-[#BB4D00]",
  danger:  "bg-[#C10007]",
  info:    "bg-[#004DE7]",
  accent:  "bg-[#5A3DD0]",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "h-5 gap-1 rounded-full px-2",
  md: "h-6 gap-1.5 rounded-full px-2.5",
};

const 
Badge = forwardRef<HTMLSpanElement, BadgeProps>(
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
          "inline-flex items-center font-medium leading-none whitespace-nowrap text-caption-m!",
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
