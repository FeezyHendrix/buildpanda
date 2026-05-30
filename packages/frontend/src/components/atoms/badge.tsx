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
  neutral: "bg-[#F6F6F6] text-gray-700",
  success: "bg-[#E8F7EE] text-[#1B8E45]",
  warning: "bg-[#FFF3E0] text-[#C26A00]",
  danger: "bg-[#FDECEC] text-[#C72525]",
  info: "bg-[#E6EFFE] text-[#004DE7]",
  accent: "bg-[#EDE7FF] text-[#5A3DD0]",
};

const solidStyles: Record<BadgeTone, string> = {
  neutral: "bg-gray-700 text-white",
  success: "bg-[#1B8E45] text-white",
  warning: "bg-[#C26A00] text-white",
  danger: "bg-[#C72525] text-white",
  info: "bg-[#004DE7] text-white",
  accent: "bg-[#5A3DD0] text-white",
};

const outlineStyles: Record<BadgeTone, string> = {
  neutral: "border border-gray-300 text-gray-700",
  success: "border border-[#1B8E45]/40 text-[#1B8E45]",
  warning: "border border-[#C26A00]/40 text-[#C26A00]",
  danger: "border border-[#C72525]/40 text-[#C72525]",
  info: "border border-[#004DE7]/40 text-[#004DE7]",
  accent: "border border-[#5A3DD0]/40 text-[#5A3DD0]",
};

const dotStyles: Record<BadgeTone, string> = {
  neutral: "bg-gray-500",
  success: "bg-[#1B8E45]",
  warning: "bg-[#C26A00]",
  danger: "bg-[#C72525]",
  info: "bg-[#004DE7]",
  accent: "bg-[#5A3DD0]",
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
