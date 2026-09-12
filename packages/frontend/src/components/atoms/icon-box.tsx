import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type IconBoxTone =
  | "brand"
  | "orange"
  | "green"
  | "purple"
  | "amber"
  | "red"
  | "gray";

type IconBoxSize = "sm" | "md" | "lg";

interface IconBoxProps extends HTMLAttributes<HTMLDivElement> {
  tone?: IconBoxTone;
  size?: IconBoxSize;
  icon: ReactNode;
}

const toneStyles: Record<IconBoxTone, string> = {
  brand: "bg-primary-50 text-primary-500",
  orange: "bg-[#FFEFD9] text-[#D8741F]",
  green: "bg-success-50 text-success-500",
  purple: "bg-accent-50 text-accent-500",
  amber: "bg-warning-50 text-warning-500",
  red: "bg-negative-50 text-negative-500",
  gray: "bg-surface-alt text-gray-700",
};

const sizeStyles: Record<IconBoxSize, string> = {
  sm: "size-9 rounded-lg [&_svg]:size-4 [&_img]:size-4",
  md: "size-11 rounded-lg [&_svg]:size-5 [&_img]:size-5",
  lg: "size-14 rounded-lg [&_svg]:size-6 [&_img]:size-6",
};

const IconBox = forwardRef<HTMLDivElement, IconBoxProps>(
  ({ tone = "brand", size = "md", icon, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        toneStyles[tone],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {icon}
    </div>
  ),
);

IconBox.displayName = "IconBox";

export { IconBox, type IconBoxProps, type IconBoxTone };
